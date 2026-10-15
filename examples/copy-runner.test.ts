import { describe, expect, test } from "bun:test";
// @ts-expect-error a plain .mjs example
import { decide, settings } from "./copy-runner.mjs";

const cfg = settings({});
const card = (o: object = {}) => ({ ok: true, token: { networkId: 1399811149, address: "MINT", symbol: "BONK" }, warnings: [], blocked: null, ...o });
const buy = { direction: "buy", usd: 50, tokenAddress: "MINT", networkId: 1399811149 };

describe("the example runner's decision", () => {
  test("a fresh buy of a clean token from a patient wallet is copied", () => {
    expect(decide({ swap: buy, holding: { scalper: false }, card: card(), held: new Set(), cfg })).toMatchObject({ act: true, address: "MINT" });
  });
  test("small buys, scalpers, blocked tokens, filter failures and held tokens are skipped", () => {
    const no = (o: object) => decide({ swap: buy, holding: { scalper: false }, card: card(), held: new Set(), cfg, ...o }).act;
    expect(no({ swap: { ...buy, usd: 5 } })).toBe(false);
    expect(no({ holding: { scalper: true, medianHoldMin: 1.3 } })).toBe(false);
    expect(no({ card: card({ blocked: "The risk check says danger" }) })).toBe(false);
    expect(no({ card: card({ warnings: [{ key: "sniper", value: 40, limit: 20 }] }) })).toBe(false);
    expect(no({ held: new Set(["1399811149:MINT"]) })).toBe(false);
    expect(no({ swap: { ...buy, direction: "sell" } })).toBe(false);
  });
  test("paper unless LIVE=1", () => {
    expect(settings({}).live).toBe(false);
    expect(settings({ LIVE: "1" }).live).toBe(true);
  });
});
