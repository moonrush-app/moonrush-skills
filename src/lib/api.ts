import { loadConfig } from "./config.js";
import { loadPrivateKey } from "./keypair.js";
import { signRequest } from "./sign.js";

/**
 * One HTTP client for an API that answers in TWO envelopes.
 *
 * Most routes answer `{ ok, data }`. The `/proxy/*` routes answer
 * `{ success, responseObject }`: a different shape for the same idea, and a client that
 * knows only one silently reads `undefined` off the other. Both are unwrapped here so no
 * command has to care which it called.
 *
 * Errors come in two shapes too: `{ ok: false, error: { code, message } }` on most routes,
 * and `{ ok: false, error: "a string" }` on a few older handlers. Both are read.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** A 401 that survived a refresh attempt, so re-applying credentials is the only fix. */
  get isExpiredAuth(): boolean {
    return this.status === 401;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  /** For the handful of routes that need no token. */
  anonymous?: boolean;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  return request<T>(path, opts);
}

/**
 * The API-key path: through the gateway, with a signature when we have a key to sign with.
 *
 * ⚠️ SIGNED WHENEVER POSSIBLE, NOT ONLY WHEN REQUIRED. The gateway decides which endpoints
 * need a signature, and that table lives on the server. Mirroring it here would be a second
 * copy of a security policy, drifting quietly, and a client that guessed "this one does not
 * need signing" would be refused with a message about signatures for a call it thought was
 * public. Signing everything is never wrong: the gateway ignores a signature it did not
 * ask for.
 *
 * With no private key on disk, reads still work and anything private fails with the
 * gateway's own message, which names the missing piece.
 */
async function requestWithApiKey<T>(path: string, opts: Options): Promise<T> {
  const cfg = loadConfig();
  const url = new URL(path, cfg.gatewayBase);
  const body = opts.body ? JSON.stringify(opts.body) : "";

  const headers: Record<string, string> = {
    "x-apikey": cfg.apiKey!,
    ...(opts.body ? { "content-type": "application/json" } : {}),
  };

  const privateKey = loadPrivateKey();
  if (privateKey) {
    const signed = signRequest({
      path: url.pathname,
      query: url.searchParams,
      body,
      privateKeyPem: privateKey,
    });
    // Set AFTER signing and from the returned values, because they are part of what was
    // signed. Generating a second timestamp here would sign one request and send another.
    url.searchParams.set("timestamp", String(signed.timestamp));
    url.searchParams.set("client_id", signed.clientId);
    headers["x-signature"] = signed.signature;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: body || undefined,
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      `${res.status} and the body was not JSON: ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const envelope = parsed as {
    ok?: boolean;
    data?: unknown;
    success?: boolean;
    responseObject?: unknown;
    error?: unknown;
  } | null;

  if (!res.ok || envelope?.ok === false || envelope?.success === false) {
    const err = envelope?.error;
    const message =
      typeof err === "string"
        ? err
        : ((err as { message?: string })?.message ?? `HTTP ${res.status}`);
    throw new ApiError(
      message,
      res.status,
      typeof err === "object" ? (err as { code?: string })?.code : undefined,
    );
  }

  if (envelope && "responseObject" in envelope) return envelope.responseObject as T;
  if (envelope && "data" in envelope) return envelope.data as T;
  return envelope as T;
}

async function request<T>(path: string, opts: Options): Promise<T> {
  const cfg = loadConfig();

  // AN API KEY OR NOTHING. This used to carry a second path: a Privy access token in a
  // bearer header, refreshed from a stored refresh token when it expired. That meant a
  // long-lived credential to somebody's whole account sitting in a file on disk, which the
  // console never needs to issue: an API key is scoped, revocable from a page, and its
  // signing half is generated locally and never uploaded.
  //
  // The admin origin went the same way in 0.5.3, for the same reason: fewer ways in is
  // fewer things to get wrong.
  if (!opts.anonymous) {
    if (!cfg.apiKey) {
      throw new ApiError(
        "No API key configured. Run `moonrush-cli config` for how to get one.",
        401,
      );
    }
    return requestWithApiKey<T>(path, opts);
  }

  // The anonymous routes (`token verified`, `token check`, `market config`) go straight to
  // the API with no credential at all, which is what makes them the way to check that the
  // CLI can reach it.
  const res = await fetch(`${cfg.apiBase}${path}`, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "content-type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // NEVER `credentials: "include"`. The backend sends `origin: "*"` with
    // `credentials: true`, a combination browsers refuse outright.
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      `${res.status} and the body was not JSON: ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const body = parsed as {
    ok?: boolean;
    data?: unknown;
    success?: boolean;
    responseObject?: unknown;
    error?: unknown;
  } | null;

  if (!res.ok || body?.ok === false || body?.success === false) {
    const err = body?.error;
    const message =
      typeof err === "string"
        ? err
        : ((err as { message?: string })?.message ?? `HTTP ${res.status}`);
    throw new ApiError(
      message,
      res.status,
      typeof err === "object" ? (err as { code?: string })?.code : undefined,
    );
  }

  // `responseObject` first: a `/proxy` response carries `success` and not `ok`, so testing
  // for `data` would return undefined for every one of them.
  if (body && "responseObject" in body) return body.responseObject as T;
  if (body && "data" in body) return body.data as T;
  return body as T;
}
