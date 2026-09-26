import { createSign, sign as edSign } from "node:crypto";
import { randomUUID } from "node:crypto";

/**
 * Signing a request the way the gateway verifies it.
 *
 * ⚠️ THE MESSAGE MUST MATCH EXACTLY, byte for byte, or the answer is "the signature does
 * not match this request" with nothing to say which half disagreed. The shape is mirrored
 * from `workers/ai-api/src/signature.ts`:
 *
 *     {path}:{sorted_query_string}:{body}:{timestamp}
 *
 * Two copies of one format is a thing that can drift, and the alternative was worse: a
 * shared package would make this CLI depend on the backend monorepo. The guard is that
 * both sides have tests over the same worked examples.
 */

export interface SignedAuth {
  /** Added to the query. Both are part of the signed message. */
  timestamp: number;
  clientId: string;
  signature: string;
}

/** Sorted by key; repeated keys emitted as repeated pairs, sorted by value. */
export function buildMessage(
  path: string,
  query: URLSearchParams,
  body: string,
  timestamp: number,
): string {
  const grouped = new Map<string, string[]>();
  for (const [k, v] of query) {
    const list = grouped.get(k);
    if (list) list.push(v);
    else grouped.set(k, [v]);
  }
  const sorted = [...grouped.keys()]
    .sort()
    .flatMap((k) =>
      grouped
        .get(k)!
        .slice()
        .sort()
        .map((v) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
    )
    .join("&");
  return `${path}:${sorted}:${body}:${timestamp}`;
}

/**
 * Sign, and hand back everything the request needs.
 *
 * ⚠️ `timestamp` AND `client_id` GO IN THE QUERY BEFORE THE MESSAGE IS BUILT. They are part
 * of what is signed, so adding them afterwards produces a signature for a different request
 * than the one sent. The caller is given them back rather than generating its own for
 * exactly that reason.
 */
export function signRequest(opts: {
  path: string;
  query: URLSearchParams;
  body: string;
  privateKeyPem: string;
}): SignedAuth {
  const timestamp = Math.floor(Date.now() / 1000);
  const clientId = randomUUID();

  const query = new URLSearchParams(opts.query);
  query.set("timestamp", String(timestamp));
  query.set("client_id", clientId);

  const message = buildMessage(opts.path, query, opts.body, timestamp);
  const bytes = Buffer.from(message, "utf8");

  const signature = opts.privateKeyPem.includes("BEGIN PRIVATE KEY")
    ? // Ed25519 signs the message directly. Passing a hash algorithm here is an error, not
      // an option: the scheme has its own hashing built in.
      edSign(null, bytes, opts.privateKeyPem).toString("base64")
    : signRsa(bytes, opts.privateKeyPem);

  return { timestamp, clientId, signature };
}

/** RSA-PSS with a 32-byte salt, which is what the gateway verifies with. */
function signRsa(bytes: Buffer, pem: string): string {
  const signer = createSign("sha256");
  signer.update(bytes);
  return signer
    .sign({ key: pem, padding: 6 /* RSA_PKCS1_PSS_PADDING */, saltLength: 32 })
    .toString("base64");
}
