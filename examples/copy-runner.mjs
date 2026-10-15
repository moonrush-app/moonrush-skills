#!/usr/bin/env node
/**
 * A copy-trading runner built only on moonrush-cli: the blocks the Moonrush Agent uses, run
 * by you. One pass per invocation, so run it from cron (every minute or two).
 *
 *   For each wallet you watch (moonrush-cli agent watch add <address>):
 *     skip it when it is a scalper (sells within minutes of buying)
 *     for each buy since the last pass, at least MIN_BUY_USD:
 *       look the token up; skip what is blocked, held already, or fails a filter
 *       buy BUY_USD of it
 *       leave a stop loss and a take profit as standing orders
 *       tell yourself on Telegram
 *
 * PAPER BY DEFAULT: buys and orders go to the API key's paper account. Set LIVE=1 to trade
 * real money; that needs an AGENT key (it trades without a prompt, inside the key's limits,
 * from the key's own wallet). With a plain trading key, live trades stop at a prompt.
 *
 *   BUY_USD=10 STOP_PCT=30 TP_PCT=100 TP_SELL_PCT=50 MIN_BUY_USD=20 node copy-runner.mjs
 *
 * State (the last trade seen per wallet) is kept in ~/.moonrush-copy-runner.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const settings = (env = process.env) => ({
  live: env.LIVE === "1",
  buyUsd: Number(env.BUY_USD ?? 10),
  minBuyUsd: Number(env.MIN_BUY_USD ?? 20),
  stopPct: Number(env.STOP_PCT ?? 30),
  tpPct: Number(env.TP_PCT ?? 100),
  tpSellPct: Number(env.TP_SELL_PCT ?? 50),
  maxWarnings: Number(env.MAX_WARNINGS ?? 0),
});

/**
 * What to do with one wallet's buy. Pure, so it is tested.
 *   swap      a buy from `agent activity --wallet` (direction, tokenAddress, usd, networkId)
 *   holding   that wallet's `holding` (scalper flag)
 *   card      `agent token <address>` for the token (ok, token, warnings, blocked)
 *   held      tokens already held, as "networkId:address"
 */
export function decide({ swap, holding, card, held, cfg }) {
  if (swap.direction !== "buy") return { act: false, why: "not a buy" };
  if (!(swap.usd >= cfg.minBuyUsd)) return { act: false, why: `buy of $${swap.usd} under $${cfg.minBuyUsd}` };
  if (holding?.scalper) return { act: false, why: `the wallet is a scalper (median hold ${holding.medianHoldMin} min)` };
  if (!card?.ok || !card.token) return { act: false, why: card?.message ?? "token not found" };
  if (card.blocked) return { act: false, why: card.blocked };
  if ((card.warnings ?? []).length > cfg.maxWarnings) {
    return { act: false, why: `fails ${card.warnings.map((w) => w.key).join(", ")}` };
  }
  const key = `${card.token.networkId}:${card.token.address}`;
  if (held.has(key)) return { act: false, why: "already held" };
  return { act: true, networkId: card.token.networkId, address: card.token.address, symbol: card.token.symbol ?? "?" };
}

const cli = (...args) => JSON.parse(execFileSync("moonrush-cli", [...args, "--raw"], { encoding: "utf8" }));
const data = (r) => (r && typeof r === "object" && "data" in r ? r.data : r);
const STATE = join(homedir(), ".moonrush-copy-runner.json");

async function pass() {
  const cfg = settings();
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const paper = cfg.live ? [] : ["--paper"];

  const { wallets } = cli("agent", "watch", "list");
  const positions = cfg.live ? data(cli("positions", "me")) : data(cli("paper", "status")).positions;
  const held = new Set(
    (Array.isArray(positions) ? positions : positions?.items ?? []).map(
      (p) => `${p.networkId}:${p.tokenAddress ?? p.address}`,
    ),
  );

  for (const w of wallets ?? []) {
    const r = cli("agent", "activity", "--wallet", w.address, "--limit", "20");
    const swaps = (r.data ?? []).filter((s) => s.blockTime > (state[w.address] ?? Date.now() / 1000 - 300));
    if (swaps.length) state[w.address] = Math.max(...swaps.map((s) => s.blockTime));
    for (const swap of swaps.reverse()) {
      if (swap.direction !== "buy") continue;
      const card = cli("agent", "token", swap.tokenAddress, ...(w.kind === "evm" ? ["--chain", String(swap.networkId)] : []));
      const d = decide({ swap, holding: r.holding, card, held, cfg });
      const who = w.label ?? w.address.slice(0, 6);
      if (!d.act) {
        console.log(`skip ${who} ${swap.tokenSymbol ?? swap.tokenAddress}: ${d.why}`);
        continue;
      }
      const chain = ["--networkId", String(d.networkId)];
      const bought = cfg.live
        ? cli("trade", "buy", "--address", d.address, "--usd", String(cfg.buyUsd), ...chain)
        : cli("paper", "buy", "--address", d.address, "--usd", String(cfg.buyUsd), ...chain);
      held.add(`${d.networkId}:${d.address}`);
      cli("orders", "create", ...paper, "--kind", "sl", "--address", d.address, ...chain, "--change", String(-cfg.stopPct), "--percent", "100");
      cli("orders", "create", ...paper, "--kind", "tp", "--address", d.address, ...chain, "--change", String(cfg.tpPct), "--percent", String(cfg.tpSellPct));
      const msg = `${cfg.live ? "" : "[paper] "}Copied ${who}: bought $${cfg.buyUsd} of ${d.symbol}. Stop -${cfg.stopPct}%, take ${cfg.tpSellPct}% at +${cfg.tpPct}%.`;
      console.log(msg, data(bought)?.message ?? "");
      try {
        cli("agent", "notify", "--text", msg);
      } catch {
        // No Telegram linked: the log line above is the record.
      }
    }
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  pass().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
