import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as OrdersModule from "./orders";
import type * as TradeModule from "./trade";
import type * as ConfirmModule from "../lib/confirm";

// Imported only after HOME points at an empty directory: the config path is fixed at import
// time, and these tests must never read, or sign with, the credentials of the machine
// running them.
let runOrders: typeof OrdersModule.runOrders;
let priceString: typeof OrdersModule.priceString;
let runTrade: typeof TradeModule.runTrade;
let Refused: typeof ConfirmModule.Refused;

/**
 * The two commands that spend money, against a fake API.
 *
 * What matters most is what is NOT sent: with no terminal and no --yes, nothing that buys,
 * sells or arms an order may reach the server. The quote and the reads before it are fine.
 */

const TOKEN = "So11111111111111111111111111111111111111112";
const TRADE_ID = "6408b689-de60-4214-928d-69e20ff23308";
let calls: { method: string; path: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;
const realIsTTY = process.stdin.isTTY;
const realWrite = process.stdout.write.bind(process.stdout);

function answer(path: string): unknown {
  if (path.startsWith("/proxy/tokenDetails")) {
    return { success: true, responseObject: { token: { decimals: 9, symbol: "TST" }, priceUSD: 2 } };
  }
  if (path.startsWith("/swap/quote")) return { ok: true, data: { outAmountUI: 4.9, outputAmount: "4900000000" } };
  if (path.startsWith("/positions/me")) {
    return { ok: true, data: { items: [{ id: TRADE_ID, tokenAddress: TOKEN, networkId: 1399811149 }] } };
  }
  if (path.startsWith("/wallet/balances")) {
    return { ok: true, data: { tokens: [{ tokenAddress: TOKEN, networkId: 1399811149, balance: "8000000000" }] } };
  }
  return { ok: true, data: { signature: "sig", id: "order" } };
}

beforeAll(async () => {
  process.env.HOME = mkdtempSync(join(tmpdir(), "mr-cli-"));
  process.env.XDG_CONFIG_HOME = process.env.HOME;
  process.env.MOONRUSH_CONFIG_DIR = join(process.env.HOME, "moonrush");
  process.env.MOONRUSH_TOKEN = "test-session";
  process.env.MOONRUSH_API_BASE = "https://api.test";
  delete process.env.MOONRUSH_API_KEY;
  ({ runOrders, priceString } = await import("./orders"));
  ({ runTrade } = await import("./trade"));
  ({ Refused } = await import("../lib/confirm"));
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(url.toString());
    calls.push({ method: init?.method ?? "GET", path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    // Nothing here may come from the machine's own config.
    if (u.host !== "api.test") throw new Error(`unexpected host ${u.host}`);
    return new Response(JSON.stringify(answer(u.pathname)), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  // Commands print JSON on success; keep the test output readable.
  process.stdout.write = (() => true) as typeof process.stdout.write;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  process.stdout.write = realWrite;
});

afterEach(() => {
  calls = [];
  Object.defineProperty(process.stdin, "isTTY", { value: realIsTTY, configurable: true });
});

const noTerminal = () => Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
const spent = () => calls.filter((c) => ["/swap/buy", "/swap/sell", "/orders", "/evm/buy", "/evm/sell"].some((p) => c.path === p) && c.method === "POST");

describe("trade", () => {
  test("no terminal and no --yes: quoted, refused, nothing bought", async () => {
    noTerminal();
    await expect(runTrade("buy", { address: TOKEN, usd: "10" })).rejects.toBeInstanceOf(Refused);
    expect(calls.some((c) => c.path === "/swap/quote")).toBe(true);
    expect(spent()).toEqual([]);
  });

  test("with --yes, the buy sends exact USDC units and the quoted amount", async () => {
    noTerminal();
    expect(await runTrade("buy", { address: TOKEN, usd: "10", yes: true, slippage: "3" })).toBe(0);
    const [buy] = spent();
    expect(buy?.path).toBe("/swap/buy");
    expect(buy?.body).toEqual({ token: TOKEN, amountRaw: "10000000", slippageBps: 300, expectedOutRaw: "4900000000" });
  });

  test("a percent sell is a share of the raw balance, rounded down", async () => {
    noTerminal();
    await runTrade("sell", { address: TOKEN, percent: "25", yes: true });
    expect(spent()[0]?.body).toMatchObject({ token: TOKEN, amountRaw: "2000000000" });
  });
});

describe("orders", () => {
  test("no terminal and no --yes: refused, no order written", async () => {
    noTerminal();
    await expect(runOrders("create", { kind: "sl", address: TOKEN, change: "-20", percent: "50" })).rejects.toBeInstanceOf(Refused);
    expect(spent()).toEqual([]);
  });

  test("a stop-loss by percent is a share of the open position, attached to it", async () => {
    noTerminal();
    await runOrders("create", { kind: "sl", address: TOKEN, change: "-20", percent: "50", yes: true });
    expect(spent()[0]?.body).toMatchObject({
      kind: "stop_loss",
      side: "sell",
      tokenAddress: TOKEN,
      triggerPrice: "1.6",
      sellBps: 5000,
      tradeId: TRADE_ID,
    });
  });

  test("a limit buy is dollars in USDC units", async () => {
    noTerminal();
    await runOrders("create", { kind: "limit", side: "buy", address: TOKEN, price: "1.5", usd: "25", yes: true });
    expect(spent()[0]?.body).toMatchObject({ kind: "limit", side: "buy", triggerPrice: "1.5", amountInRaw: "25000000" });
  });

  test("cancel needs no confirmation: it moves nothing", async () => {
    noTerminal();
    expect(await runOrders("cancel", { id: TRADE_ID })).toBe(0);
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", path: `/orders/${TRADE_ID}` });
  });
});

test("the confirmation reads both routes' quotes in human units", async () => {
  const { expectedText } = await import("./trade");
  const base = { networkId: 4663, address: "0x98096d17e191b3da1d5f99a6d7b3584351b11e18", symbol: "BONER", decimals: 18, amountRaw: "1", spendText: "", evmAmount: "1" };
  // EVM preview: raw USDC on a sell. "911096" is $0.911096, not $911096.
  expect(expectedText({ ...base, side: "sell" }, { amountOut: "911096" })).toBe("about $0.911096 USDC");
  expect(expectedText({ ...base, side: "buy" }, { amountOut: "2500000000000000000" })).toBe("about 2.5 BONER");
  expect(expectedText({ ...base, side: "buy", decimals: null }, { amountOut: "25" })).toBe("");
  // Solana quote: already human.
  expect(expectedText({ ...base, networkId: 1399811149, side: "buy" }, { outAmountUI: 12913.17305 })).toBe("about 12913.17305 BONER");
});

test("trigger prices never reach the API in exponent form", () => {
  expect(priceString(0.0000123)).toBe("0.0000123");
  expect(priceString(1.6)).toBe("1.6");
  expect(priceString(3412.5)).toBe("3412.5");
});
