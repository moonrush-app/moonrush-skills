import { generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_DIR } from "./config.js";

/**
 * The signing key for an API key, generated here and never sent anywhere.
 *
 * ⚠️ THE PRIVATE HALF DOES NOT LEAVE THIS MACHINE. That is the whole reason the console
 * asks for a public key rather than issuing a secret: a credential that was never
 * transmitted cannot be intercepted in transit, read out of a server's logs, or leaked by
 * a database dump. What the server stores can verify a signature and cannot make one.
 *
 * Ed25519 rather than RSA. Both are accepted by the gateway, but Ed25519 keys are 32 bytes
 * against RSA's hundreds, sign faster, and have no parameters to get wrong. RSA exists in
 * the gateway for anyone who already has a key they must reuse.
 */

export const PRIVATE_KEY_PATH = join(CONFIG_DIR, "signing-key.pem");

export interface GeneratedKey {
  privateKeyPath: string;
  publicKeyPem: string;
}

/**
 * Make a keypair and store the private half at mode 600.
 *
 * Refuses to overwrite. A key that is already registered with the console would become
 * unusable the moment it is replaced, and every command would start failing with "the
 * signature does not match" while the console still lists the key as live. Losing that
 * quietly is worse than making somebody pass a flag.
 */
export function generateKeypair(force = false): GeneratedKey {
  if (existsSync(PRIVATE_KEY_PATH) && !force) {
    throw new Error(
      `A signing key already exists at ${PRIVATE_KEY_PATH}.\n` +
        `Replacing it breaks every API key registered with the old one, and the console\n` +
        `will still show them as live. Use --force only if you mean that.`,
    );
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  mkdirSync(dirname(PRIVATE_KEY_PATH), { recursive: true });
  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 });
  // Set again: `writeFileSync`'s mode is masked by the umask, and does nothing at all to a
  // file that already existed.
  chmodSync(PRIVATE_KEY_PATH, 0o600);

  return { privateKeyPath: PRIVATE_KEY_PATH, publicKeyPem: publicPem };
}

/** The stored private key, or null when there is none to sign with. */
export function loadPrivateKey(): string | null {
  if (!existsSync(PRIVATE_KEY_PATH)) return null;
  return readFileSync(PRIVATE_KEY_PATH, "utf8");
}
