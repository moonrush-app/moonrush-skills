import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import {
  USDC_DECIMALS,
  decimalToRaw,
  parseSlippageBps,
  percentToBps,
  rawToDecimal,
} from "../lib/amount.js";
import { openPositionId, tokenFacts } from "../lib/holdings.js";
import {
  InvalidArgument,
  NETWORKS,
  checkFlags,
  parseChoice,
  parseInteger,
  parseNetworkId,
  requireAddress,
  requireUuid,
} from "../lib/validate.js";

const USAGE = `moonrush-cli orders <sub> [options]

  list      Your orders: open (default), closed, or all
  create    A limit, take-profit, stop-loss or trailing order. SPENDS MONEY LATER.
  cancel    Withdraw an open order: --id <uuid>

create:
  --kind limit|tp|sl|trailing-tp|trailing-sl
  --side buy|sell            limit only; tp/sl/trailing are sells
  --address <token>          required
  --networkId <id|name>      solana (default), robinhood, base, bnb, soneium, arc
  --price <usd>              the trigger price, or
  --change <pct>             the trigger as a move from today's price: -20, 50
  --usd <n>                  buy: dollars to spend
  --percent <p>              sell: share of your open position when it fires
  --amount <n>               sell: number of tokens
  --trail <pct>              trailing orders: how far the price may give back
  --slippage <pct>           tolerance in percent (default: the platform's)
  --worse-fill               fill past the slippage band rather than decline
  --expires <days>           1 to 30 (default: the server's)

list: --status open|closed|all  --limit <n>

create asks on a terminal before writing the order: once armed it trades by itself.
--yes skips the question and is for a person to type, never an agent.`;

type Flags = Record<string, string | true>;

const KINDS: Record<string, string> = {
  limit: "limit",
  tp: "take_profit",
  "take-profit": "take_profit",
  sl: "stop_loss",
  "stop-loss": "stop_loss",
  "trailing-tp": "trailing_take_profit",
  "trailing-sl": "trailing_stop_loss",
};

const LABEL: Record<string, string> = {
  limit: "Limit",
  take_profit: "Take profit",
  stop_loss: "Stop loss",
  trailing_take_profit: "Trailing take profit",
  trailing_stop_loss: "Trailing stop",
};

/** A USD price as the decimal string the API wants. Never through a float's exponent form. */
export function priceString(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new InvalidArgument("The trigger price must be above zero");
  // Twelve significant digits keeps a 0.000012 memecoin price exact enough to trigger on.
  const s = n.toPrecision(12);
  return s.includes("e") ? n.toFixed(18).replace(/0+$/, "").replace(/\.$/, "") : s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

async function create(flags: Flags): Promise<number> {
  const kindKey = typeof flags.kind === "string" ? flags.kind.toLowerCase() : "";
  const kind = KINDS[kindKey];
  if (!kind) throw new InvalidArgument(`--kind is one of: ${Object.keys(KINDS).join(", ")}`);
  const trailing = kind.startsWith("trailing_");

  const side = kind === "limit" ? parseChoice(flags.side, "side", ["buy", "sell"] as const, "buy") : "sell";
  if (kind !== "limit" && flags.side === "buy") {
    // Not refused for being unusual: refused because the API reads a buy-side stop as a
    // breakout entry, and someone typing `--kind sl --side buy` almost certainly did not
    // mean that.
    throw new InvalidArgument("Take-profit, stop-loss and trailing orders sell. Use --kind limit for a buy.");
  }

  const networkId = parseNetworkId(flags.networkId);
  const address = requireAddress(flags.address, networkId);

  // Argument mistakes first, before any request.
  if ((flags.price === undefined) === (flags.change === undefined)) {
    throw new InvalidArgument("Give exactly one of --price or --change");
  }
  if (side === "buy" && typeof flags.usd !== "string") {
    throw new InvalidArgument("A buy order needs --usd <dollars>");
  }
  if (side === "sell" && ["percent", "amount"].filter((k) => flags[k] !== undefined).length !== 1) {
    throw new InvalidArgument("A sell order needs exactly one of --percent or --amount");
  }
  if (trailing && flags.trail === undefined) throw new InvalidArgument("A trailing order needs --trail <pct>");
  if (!trailing && flags.trail !== undefined) throw new InvalidArgument("--trail belongs to trailing orders only");

  const facts = await tokenFacts(address, networkId);

  // ── The trigger ──
  let trigger: number;
  if (flags.price !== undefined) {
    trigger = Number(flags.price);
  } else {
    if (facts.priceUsd == null) throw new InvalidArgument("No live price for this token, so --change has nothing to move from. Use --price.");
    const pct = Number(flags.change);
    if (!Number.isFinite(pct) || pct <= -100) throw new InvalidArgument("--change is a percentage above -100, e.g. -20 or 50");
    trigger = facts.priceUsd * (1 + pct / 100);
  }
  const triggerPrice = priceString(trigger);

  // ── The amount ──
  const body: Record<string, unknown> = { kind, side, networkId, tokenAddress: address, triggerPrice };
  let sizeText: string;
  if (side === "buy") {
    if (typeof flags.usd !== "string") throw new InvalidArgument("A buy order needs --usd <dollars>");
    body.amountInRaw = decimalToRaw(flags.usd, USDC_DECIMALS, "usd");
    sizeText = `$${rawToDecimal(String(body.amountInRaw), USDC_DECIMALS)}`;
  } else {
    const given = ["percent", "amount"].filter((k) => flags[k] !== undefined);
    if (given.length !== 1) throw new InvalidArgument("A sell order needs exactly one of --percent or --amount");
    const tradeId = await openPositionId(address, networkId);
    if (flags.percent !== undefined) {
      // A SHARE OF THE POSITION AT FIRE TIME, not of today's balance. That is what a
      // stop-loss means: "sell half of whatever I am holding when it hits".
      if (!tradeId) throw new InvalidArgument(`--percent needs an open position in ${facts.symbol}, and there is none. Use --amount.`);
      body.sellBps = percentToBps(flags.percent);
      sizeText = `${Number(body.sellBps) / 100}% of your ${facts.symbol}`;
    } else {
      body.amountInRaw = decimalToRaw(String(flags.amount), facts.decimals, "amount");
      sizeText = `${rawToDecimal(String(body.amountInRaw), facts.decimals)} ${facts.symbol}`;
    }
    // Attached whenever there is one, so the order is cancelled with the position it guards.
    if (tradeId) body.tradeId = tradeId;
  }

  if (trailing) {
    if (flags.trail === undefined) throw new InvalidArgument("A trailing order needs --trail <pct>");
    body.trailBps = percentToBps(flags.trail, "trail");
  } else if (flags.trail !== undefined) {
    throw new InvalidArgument("--trail belongs to trailing orders only");
  }

  const slippage = parseSlippageBps(flags.slippage);
  if (slippage) body.maxSlippageBps = slippage;
  if (flags["worse-fill"] !== undefined) body.allowWorseFill = true;
  if (flags.expires !== undefined) {
    const days = parseInteger(flags.expires, "expires", { min: 1, max: 30, fallback: 7 });
    body.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  }

  const now = facts.priceUsd != null ? ` (now $${priceString(facts.priceUsd)})` : "";
  await confirm(
    `${LABEL[kind]} ${side.toUpperCase()} on ${NETWORKS[networkId]}: ${sizeText} when ${facts.symbol} reaches $${triggerPrice}${now}` +
      `${body.trailBps ? `, trailing ${Number(body.trailBps) / 100}%` : ""}` +
      `${body.allowWorseFill ? ", filling past the slippage band if it must" : ""}.\n` +
      `Token: ${address}\n` +
      `Once armed this trades from your wallet on its own, with nobody asked again.`,
    flags,
  );

  print(await api("/orders", { method: "POST", body }), flags);
  return 0;
}

export async function runOrders(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return flags.help ? 0 : 1;
  }

  const ALLOWED: Record<string, readonly string[]> = {
    list: ["status", "limit"],
    create: ["kind", "side", "address", "networkId", "price", "change", "usd", "percent", "amount", "trail", "slippage", "worse-fill", "expires", "yes"],
    cancel: ["id"],
  };
  if (!ALLOWED[sub]) {
    process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
    return 1;
  }
  checkFlags(flags, ALLOWED[sub]!, `orders ${sub}`);

  switch (sub) {
    case "list": {
      const status = parseChoice(flags.status, "status", ["open", "closed", "all"] as const, "open");
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 50 });
      print(await api(`/orders?status=${status}&limit=${limit}`), flags);
      return 0;
    }
    case "create":
      return create(flags);
    case "cancel": {
      // No confirmation: withdrawing an order moves nothing, and an order someone wants gone
      // should not wait behind a prompt while the price runs at its trigger.
      const id = requireUuid(flags.id, "id");
      print(await api(`/orders/${id}`, { method: "DELETE" }), flags);
      return 0;
    }
  }
  return 1;
}
