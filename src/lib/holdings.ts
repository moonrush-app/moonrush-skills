import { api } from "./api.js";
import { InvalidArgument, isEvmNetwork, tokenId } from "./validate.js";

/**
 * The facts a trade needs about a token and about what the user holds of it.
 *
 * Read fresh before every money-moving command, never cached: a sell sized from a balance
 * that was true a minute ago asks for tokens that may already be gone.
 */

export interface TokenFacts {
  symbol: string;
  decimals: number;
  priceUsd: number | null;
}

/** Symbol, decimals and price, from the same endpoint `token info` reads. */
export async function tokenFacts(address: string, networkId: number): Promise<TokenFacts> {
  const d = await api<Record<string, unknown>>("/proxy/tokenDetails", {
    method: "POST",
    body: { tokenId: tokenId(address, networkId) },
  });
  const token = (d.token ?? {}) as Record<string, unknown>;
  const decimals = Number(token.decimals ?? d.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    // Refused rather than guessed. The wrong power of ten sizes a trade by a factor of a
    // thousand or more, and there is no default that is right for most tokens.
    throw new InvalidArgument(
      `Could not read this token's decimals, so an amount in tokens cannot be converted.\n` +
        `Use --percent or --all instead.`,
    );
  }
  const price = Number(d.priceUSD ?? d.price ?? token.price);
  return {
    symbol: String(token.symbol ?? d.symbol ?? "token"),
    decimals,
    priceUsd: Number.isFinite(price) && price > 0 ? price : null,
  };
}

interface BalanceRow {
  tokenAddress?: string;
  address?: string;
  networkId?: number | null;
  balance?: string;
}

const sameAddress = (a: string, b: string, evm: boolean) =>
  evm ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * The user's raw balance of one token, or 0n when they hold none.
 *
 * Raw units straight from the balances endpoint, never recomputed from a shifted number:
 * a balance passed through a double loses digits on exactly the large-supply tokens these
 * chains are full of.
 */
export async function heldRaw(address: string, networkId: number): Promise<bigint> {
  const evm = isEvmNetwork(networkId);
  const data = await api<{ tokens?: BalanceRow[] }>("/wallet/balances");
  for (const row of data.tokens ?? []) {
    const addr = row.tokenAddress ?? row.address ?? "";
    if (row.networkId != null && Number(row.networkId) !== networkId) continue;
    if (!sameAddress(addr, address, evm)) continue;
    try {
      return BigInt(row.balance ?? "0");
    } catch {
      return 0n;
    }
  }
  return 0n;
}

interface PositionRow {
  id?: string;
  tokenAddress?: string;
  networkId?: number | string;
}

/** The id of the user's OPEN position in a token, or null. A percent sell order needs it. */
export async function openPositionId(address: string, networkId: number): Promise<string | null> {
  const evm = isEvmNetwork(networkId);
  const data = await api<{ items?: PositionRow[] } | PositionRow[]>(
    "/positions/me?status=OPEN&limit=50",
  );
  const rows = Array.isArray(data) ? data : (data.items ?? []);
  for (const p of rows) {
    if (p.networkId != null && Number(p.networkId) !== networkId) continue;
    if (p.tokenAddress && sameAddress(p.tokenAddress, address, evm) && p.id) return p.id;
  }
  return null;
}
