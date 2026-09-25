/**
 * Refuse locally what the API would refuse anyway, and say why.
 *
 * Every value in this file is checked server-side too. That is not a reason to skip it
 * here, it is the reason the checks can be exact: they are copied from the schemas the API
 * validates with, so a value this file accepts is one the API accepts. What changes is the
 * answer a person gets for a typo. The API says `400 Bad Request`, which is true and tells
 * nobody which of four arguments was wrong.
 *
 * It also keeps a mistyped address from travelling. An address is the one argument here
 * that a human cannot proofread, and the next thing anybody does with a token address is
 * send money to it.
 */

/** Every chain the app trades, by the id the API wants. Mirrors FEATURE_NETWORKS. */
export const NETWORKS: Record<number, string> = {
  1399811149: "Solana",
  4663: "Robinhood",
  8453: "Base",
  56: "BNB",
  1868: "Soneium",
  5042: "Arc",
};

export const SOLANA = 1399811149;

/** Solana is the only non-EVM chain here, so the address shape follows from the id. */
export const isEvmNetwork = (networkId: number): boolean => networkId !== SOLANA;

export class InvalidArgument extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgument";
  }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * How many bytes a base58 string decodes to, or null if it is not base58 at all.
 *
 * A LENGTH CHECK IS NOT ENOUGH, which is why this decodes rather than matching a pattern.
 * Base58 is not a fixed number of characters per byte: a 44-character string can decode to
 * 32 bytes or to 33, and only one of those is a Solana address. The server decodes, so a
 * regex here would accept things the server then rejects, which is the failure this file
 * exists to prevent.
 */
export function base58ByteLength(value: string): number | null {
  if (!value) return null;
  let num = 0n;
  for (const ch of value) {
    const digit = BASE58.indexOf(ch);
    if (digit < 0) return null;
    num = num * 58n + BigInt(digit);
  }
  // A leading "1" is a leading zero byte and carries no magnitude, so it survives the
  // arithmetic above only if it is counted separately.
  let leadingZeros = 0;
  for (const ch of value) {
    if (ch !== "1") break;
    leadingZeros++;
  }
  const hex = num === 0n ? "" : num.toString(16);
  return leadingZeros + Math.ceil(hex.length / 2);
}

export const isSolanaAddress = (value: string): boolean =>
  value.length >= 32 && value.length <= 44 && base58ByteLength(value) === 32;

/** Exactly the server's rule. Case is not checked: the API does not checksum either. */
export const isEvmAddress = (value: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * One chain id, checked against the list the API actually serves.
 *
 * An unknown id is refused rather than passed through. The API answers an empty board for
 * a chain it does not know, and an empty board is indistinguishable from a quiet market:
 * the reader would conclude there was nothing trading rather than that they typed 8543.
 */
export function parseNetworkId(raw: unknown, fallback = SOLANA): number {
  if (raw === undefined || raw === true) return fallback;
  const id = Number(raw);
  if (!Number.isInteger(id) || !(id in NETWORKS)) {
    throw new InvalidArgument(
      `Unknown networkId: ${String(raw)}\nKnown chains: ` +
        Object.entries(NETWORKS)
          .map(([id, name]) => `${id} ${name}`)
          .join(", "),
    );
  }
  return id;
}

/**
 * A comma-separated list, for the boards that span chains in one call.
 *
 * Returned as the string the query wants rather than an array, because the caller's next
 * move is always to put it back in a URL.
 */
export function parseNetworkIdList(raw: unknown): string | undefined {
  if (raw === undefined || raw === true) return undefined;
  const parts = String(raw)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((p) => parseNetworkId(p)).join(",");
}

/**
 * A token address, checked against the shape its chain uses.
 *
 * THE CROSS-CHECK IS THE POINT. Either shape alone would pass a naive validator, so
 * pasting a Base address while the flag still says Solana is the mistake most likely to
 * happen and the one least likely to be noticed: the address is valid, it is simply valid
 * somewhere else. The API answers "Token not found", which reads as a dead token.
 */
export function requireAddress(raw: unknown, networkId: number): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new InvalidArgument("--address is required");
  }
  const address = raw.trim();
  const chain = NETWORKS[networkId] ?? String(networkId);

  if (isEvmNetwork(networkId)) {
    if (isEvmAddress(address)) return address;
    throw new InvalidArgument(
      isSolanaAddress(address)
        ? `That is a Solana address, but --networkId is ${networkId} (${chain}).\n` +
          `Drop --networkId to look it up on Solana.`
        : `Not a valid ${chain} address: ${address}\nExpected 0x followed by 40 hex characters.`,
    );
  }

  if (isSolanaAddress(address)) return address;
  throw new InvalidArgument(
    isEvmAddress(address)
      ? `That is an EVM address, but no --networkId was given so this is a Solana lookup.\n` +
        `Add --networkId with one of: ` +
        Object.entries(NETWORKS)
          .filter(([id]) => Number(id) !== SOLANA)
          .map(([id, name]) => `${id} ${name}`)
          .join(", ")
      : `Not a valid Solana address: ${address}\nExpected 32 to 44 base58 characters decoding to 32 bytes.`,
  );
}

/**
 * The id `/proxy/tokenDetails` actually wants: `<address>:<networkId>`.
 *
 * ⚠️ THE API DOES NOT TAKE `{ address, networkId }`. Its validator requires a single
 * `tokenId` string and rejects anything without one, so a body carrying the two fields
 * separately is a 400 every time. Built in one place so there is one thing to be wrong.
 */
export const tokenId = (address: string, networkId: number): string =>
  `${address}:${networkId}`;

/** A bounded integer, so the API's own min/max never has to answer for a typo. */
export function parseInteger(
  raw: unknown,
  name: string,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  if (raw === undefined || raw === true) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new InvalidArgument(
      `--${name} must be a whole number between ${min} and ${max}, got: ${String(raw)}`,
    );
  }
  return n;
}

/** One of a fixed set, listed in the error so nobody has to go and find the list. */
export function parseChoice<T extends string>(
  raw: unknown,
  name: string,
  choices: readonly T[],
  fallback: T,
): T {
  if (raw === undefined || raw === true) return fallback;
  const value = String(raw);
  if (!choices.includes(value as T)) {
    throw new InvalidArgument(
      `--${name} must be one of: ${choices.join(", ")}\nGot: ${value}`,
    );
  }
  return value as T;
}

/** A user id, which the API validates as a UUID and answers 400 for otherwise. */
export function requireUuid(raw: unknown, name: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new InvalidArgument(`--${name} must be a UUID, got: ${String(raw)}`);
  }
  return value;
}
