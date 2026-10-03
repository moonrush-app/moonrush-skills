/**
 * Summaries computed in code, over the raw research reads.
 *
 * A model asked to work out a win rate from four nested objects gets it slightly wrong often
 * enough to matter, and these are the numbers a decision is made on. So the arithmetic lives
 * here, tested, and the raw response is printed beside it for anything it does not cover.
 */

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : n;
};
const round = (v: number | null, places = 2) =>
  v == null ? null : Math.round(v * 10 ** places) / 10 ** places;

interface Window {
  statsUsd?: Record<string, unknown> | null;
  statsNonCurrency?: Record<string, unknown> | null;
}

/** One window of `detailedWalletStats`, as the figures a trader reads. */
export function windowSummary(w: Window | null | undefined) {
  if (!w) return null;
  const usd = w.statsUsd ?? {};
  const n = w.statsNonCurrency ?? {};
  const wins = num(n.wins) ?? 0;
  const losses = num(n.losses) ?? 0;
  const closed = wins + losses;
  return {
    swaps: num(n.swaps),
    uniqueTokens: num(n.uniqueTokens),
    wins,
    losses,
    // Of the positions that CLOSED in the window. Null with none closed: zero would read as
    // "loses every time" about a wallet that simply has not sold anything yet.
    winRatePct: closed > 0 ? round((wins / closed) * 100, 1) : null,
    realizedProfitUsd: round(num(usd.realizedProfitUsd)),
    realizedProfitPct: round(num(usd.realizedProfitPercentage)),
    volumeUsd: round(num(usd.volumeUsd)),
    averageTradeUsd: round(num(usd.averageSwapAmountUsd)),
    averageProfitPerTradeUsd: round(num(usd.averageProfitUsdPerTrade)),
  };
}

export function walletSummary(stats: Record<string, unknown> | null) {
  if (!stats) return null;
  return {
    lastTradeAt:
      typeof stats.lastTransactionAt === "number"
        ? new Date(stats.lastTransactionAt * 1000).toISOString()
        : null,
    labels: Array.isArray(stats.labels) ? stats.labels : [],
    day1: windowSummary(stats.statsDay1 as Window),
    week1: windowSummary(stats.statsWeek1 as Window),
    day30: windowSummary(stats.statsDay30 as Window),
    year1: windowSummary(stats.statsYear1 as Window),
  };
}

interface CreatedRow {
  createdAt?: number;
  marketCap?: string | number | null;
  liquidity?: string | number | null;
  holders?: number | null;
  isScam?: boolean | null;
  token?: { launchpad?: { completed?: boolean | null; migrated?: boolean | null } | null };
}

/**
 * A creator's launch record: how many, how many left their launchpad, how many are still
 * tradeable, how many are dead. The thresholds are stated in the output so the reader can
 * see what "alive" meant.
 */
export function creatorSummary(rows: CreatedRow[]) {
  const ALIVE_LIQ = 10_000;
  const DEAD_LIQ = 1_000;
  let graduated = 0;
  let alive = 0;
  let dead = 0;
  let flaggedScam = 0;
  let best: number | null = null;
  for (const r of rows) {
    if (r.token?.launchpad?.completed || r.token?.launchpad?.migrated) graduated++;
    const liq = num(r.liquidity) ?? 0;
    if (liq >= ALIVE_LIQ) alive++;
    if (liq < DEAD_LIQ) dead++;
    if (r.isScam) flaggedScam++;
    const mc = num(r.marketCap);
    if (mc != null && (best == null || mc > best)) best = mc;
  }
  const times = rows.map((r) => r.createdAt).filter((t): t is number => typeof t === "number").sort();
  return {
    launches: rows.length,
    graduated,
    aliveLiquidityOver10k: alive,
    deadLiquidityUnder1k: dead,
    flaggedScam,
    bestMarketCapNowUsd: best,
    firstLaunch: times.length ? new Date(times[0]! * 1000).toISOString() : null,
    latestLaunch: times.length ? new Date(times[times.length - 1]! * 1000).toISOString() : null,
  };
}

interface HolderRow {
  address: string;
  shiftedBalance?: number;
  balanceUsd?: string | null;
  firstHeldTimestamp?: number | null;
}

/** A holders page with each row's share of supply, when the supply is known. */
export function holderRows(items: HolderRow[], totalSupply: number | null) {
  return items.map((h, i) => ({
    rank: i + 1,
    address: h.address,
    balance: h.shiftedBalance ?? null,
    valueUsd: round(num(h.balanceUsd)),
    pctOfSupply:
      totalSupply && totalSupply > 0 && typeof h.shiftedBalance === "number"
        ? round((h.shiftedBalance / totalSupply) * 100, 3)
        : null,
    holdingSince: h.firstHeldTimestamp ? new Date(h.firstHeldTimestamp * 1000).toISOString() : null,
  }));
}

export interface TraderPosition {
  userId: string;
  username?: string | null;
  tokenAddress: string;
  networkId: string | number;
  tokenSymbol?: string | null;
  currentBalanceUsd?: string | number | null;
  openedAt?: number | null;
}

/**
 * What the top traders hold in common: one row per token, ranked by how many of them hold
 * it, then by the dollars they have in it. A token one whale holds is a position; a token
 * five of the top ten hold is a consensus, and that is the signal this exists to surface.
 */
export function smartMoney(positions: TraderPosition[], minUsd = 1) {
  const byToken = new Map<
    string,
    { tokenAddress: string; networkId: number; symbol: string | null; holders: Set<string>; usd: number; earliest: number | null; latest: number | null }
  >();
  for (const p of positions) {
    const usd = num(p.currentBalanceUsd) ?? 0;
    if (usd < minUsd) continue;
    const networkId = Number(p.networkId);
    const key = `${networkId}:${networkId === 1399811149 ? p.tokenAddress : p.tokenAddress.toLowerCase()}`;
    const row = byToken.get(key) ?? {
      tokenAddress: p.tokenAddress,
      networkId,
      symbol: p.tokenSymbol ?? null,
      holders: new Set<string>(),
      usd: 0,
      earliest: null,
      latest: null,
    };
    row.holders.add(p.username || p.userId);
    row.usd += usd;
    if (typeof p.openedAt === "number") {
      row.earliest = row.earliest == null ? p.openedAt : Math.min(row.earliest, p.openedAt);
      row.latest = row.latest == null ? p.openedAt : Math.max(row.latest, p.openedAt);
    }
    byToken.set(key, row);
  }
  return [...byToken.values()]
    .map((r) => ({
      tokenAddress: r.tokenAddress,
      networkId: r.networkId,
      symbol: r.symbol,
      topTradersHolding: r.holders.size,
      traders: [...r.holders],
      totalHeldUsd: round(r.usd),
      firstEntry: r.earliest ? new Date(r.earliest * 1000).toISOString() : null,
      latestEntry: r.latest ? new Date(r.latest * 1000).toISOString() : null,
    }))
    .sort((a, b) => b.topTradersHolding - a.topTradersHolding || (b.totalHeldUsd ?? 0) - (a.totalHeldUsd ?? 0));
}
