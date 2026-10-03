import { describe, expect, test } from "bun:test";
import { creatorSummary, holderRows, smartMoney, walletSummary, windowSummary } from "./research";

describe("wallet record", () => {
  test("win rate is over closed positions, and null when none closed", () => {
    expect(windowSummary({ statsNonCurrency: { swaps: 228, uniqueTokens: 53, wins: 10, losses: 6 }, statsUsd: { realizedProfitUsd: "8.990750020692342" } })).toMatchObject({
      winRatePct: 62.5,
      realizedProfitUsd: 8.99,
    });
    expect(windowSummary({ statsNonCurrency: { swaps: 3, wins: 0, losses: 0 } })?.winRatePct).toBeNull();
    expect(windowSummary(null)).toBeNull();
  });

  test("all four windows, and the last trade as a date", () => {
    const s = walletSummary({ lastTransactionAt: 1790961192, labels: [], statsDay30: { statsNonCurrency: { wins: 1, losses: 1 } } })!;
    expect(s.lastTradeAt).toBe("2026-10-02T17:13:12.000Z");
    expect(s.day30?.winRatePct).toBe(50);
    expect(s.day1).toBeNull();
  });
});

describe("creator record", () => {
  test("counts launches by outcome", () => {
    const s = creatorSummary([
      { createdAt: 1788194566, marketCap: "51107656", liquidity: "681634", token: { launchpad: { completed: false, migrated: false } } },
      { createdAt: 1786723795, marketCap: "22462", liquidity: "2331", token: { launchpad: { completed: false } } },
      { createdAt: 1786000000, marketCap: "900", liquidity: "120", isScam: true, token: { launchpad: { completed: true, migrated: true } } },
    ]);
    expect(s).toMatchObject({ launches: 3, graduated: 1, aliveLiquidityOver10k: 1, deadLiquidityUnder1k: 1, flaggedScam: 1, bestMarketCapNowUsd: 51107656 });
    expect(s.latestLaunch).toBe("2026-08-31T16:42:46.000Z");
  });
});

test("holder rows carry their share of supply", () => {
  const rows = holderRows([{ address: "A", shiftedBalance: 69717659.917768, balanceUsd: "59740.49" }], 992357438.098636);
  expect(rows[0]).toMatchObject({ rank: 1, address: "A", pctOfSupply: 7.025, valueUsd: 59740.49 });
  expect(holderRows([{ address: "B", shiftedBalance: 1 }], null)[0]?.pctOfSupply).toBeNull();
});


test("smart money ranks by how many top traders hold, then by dollars", () => {
  const rows = smartMoney([
    { userId: "u1", username: "a", tokenAddress: "Mint1", networkId: 1399811149, tokenSymbol: "ONE", currentBalanceUsd: "100", openedAt: 1790000000 },
    { userId: "u2", username: "b", tokenAddress: "Mint1", networkId: 1399811149, tokenSymbol: "ONE", currentBalanceUsd: "50", openedAt: 1790100000 },
    { userId: "u3", username: "c", tokenAddress: "0xAbC", networkId: "4663", tokenSymbol: "TWO", currentBalanceUsd: "5000" },
    { userId: "u1", username: "a", tokenAddress: "0xabc", networkId: 4663, tokenSymbol: "TWO", currentBalanceUsd: "0.5" },
  ]);
  expect(rows[0]).toMatchObject({ symbol: "ONE", topTradersHolding: 2, totalHeldUsd: 150 });
  // EVM addresses merge across case; the dust row is ignored.
  expect(rows[1]).toMatchObject({ symbol: "TWO", topTradersHolding: 1, totalHeldUsd: 5000 });
});
