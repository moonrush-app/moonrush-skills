import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import {
  USDC_DECIMALS,
  decimalToRaw,
  parseSlippageBps,
  percentToBps,
  rawToDecimal,
  shareOf,
} from "../lib/amount.js";
import { heldRaw, tokenFacts } from "../lib/holdings.js";
import {
  InvalidArgument,
  NETWORKS,
  checkFlags,
  isEvmNetwork,
  parseNetworkId,
  requireAddress,
} from "../lib/validate.js";

const USAGE = `moonrush-cli trade <sub> [options]

  quote    What a buy or sell would get, without trading
  buy      Spend USDC on a token. MOVES MONEY.
  sell     Sell a token for USDC. MOVES MONEY.

  --address <token>         The token (required)
  --networkId <id|name>     solana (default), robinhood, base, bnb, soneium, arc
  --side buy|sell           quote only
  --usd <n>                 buy: dollars to spend (EVM minimum $5)
  --percent <p>             sell: share of what you hold, 0 to 100
  --amount <n>              sell: number of tokens
  --all                     sell: everything you hold
  --slippage <pct>          tolerance in percent, e.g. 3 (default: the platform's)

buy and sell quote first, show the numbers, and ask on a terminal before sending.
--yes skips the question and is for a person to type, never an agent.
A submitted trade is not a filled one: check \`positions me\` a moment later.`;

type Flags = Record<string, string | true>;

export interface Plan {
  side: "buy" | "sell";
  networkId: number;
  address: string;
  symbol: string;
  /** The token's decimals, when they could be read. */
  decimals: number | null;
  /** Solana: raw input units. EVM buy: unused (dollars go as a number). */
  amountRaw: string;
  /** What is being spent, in words, for the confirmation. */
  spendText: string;
  /** EVM: dollars for a buy, minor units or "max" for a sell. */
  evmAmount: number | string;
  slippageBps?: number;
}

/**
 * Turn the flags into exactly one amount, in the units the route for this chain takes.
 *
 * ONE AMOUNT, NAMED. A sell takes `--percent`, `--amount` or `--all` and refuses two of
 * them, because "sell 50% and also 1000 tokens" has no reading that is obviously the one
 * the person meant. A buy is always dollars.
 */
async function plan(side: "buy" | "sell", flags: Flags): Promise<Plan> {
  const networkId = parseNetworkId(flags.networkId);
  const address = requireAddress(flags.address, networkId);
  const evm = isEvmNetwork(networkId);
  const slippageBps = parseSlippageBps(flags.slippage);
  // Argument mistakes first, before any request, so they are reported as what they are
  // rather than hidden behind a network error or a sign-in prompt.
  if (side === "buy" && typeof flags.usd !== "string") {
    throw new InvalidArgument("buy needs --usd <dollars>");
  }
  const given = ["percent", "amount", "all"].filter((k) => flags[k] !== undefined);
  if (side === "sell" && given.length !== 1) {
    throw new InvalidArgument("sell needs exactly one of --percent, --amount or --all");
  }
  if (flags.percent !== undefined) percentToBps(flags.percent);

  const facts = await tokenFacts(address, networkId).catch(() => null);
  const symbol = facts?.symbol ?? "token";
  const decimals = facts?.decimals ?? null;

  if (side === "buy") {
    if (typeof flags.usd !== "string") throw new InvalidArgument("buy needs --usd <dollars>");
    const usdRaw = decimalToRaw(flags.usd, USDC_DECIMALS, "usd");
    const usd = Number(rawToDecimal(usdRaw, USDC_DECIMALS));
    if (evm && usd < 5) throw new InvalidArgument("The minimum buy on EVM chains is $5");
    return {
      side,
      networkId,
      address,
      symbol,
      decimals,
      amountRaw: usdRaw,
      spendText: `$${rawToDecimal(usdRaw, USDC_DECIMALS)} USDC`,
      evmAmount: usd,
      slippageBps,
    };
  }

  // EVM, everything: "max" lets the worker read the exact on-chain balance at send time,
  // the only way a full sell leaves no dust behind.
  if (evm && flags.all !== undefined) {
    return { side, networkId, address, symbol, decimals, amountRaw: "max", spendText: `all your ${symbol}`, evmAmount: "max", slippageBps };
  }

  let raw: string;
  if (flags.amount !== undefined) {
    if (!facts) throw new InvalidArgument("Could not read the token, so --amount cannot be converted. Use --percent or --all.");
    raw = decimalToRaw(String(flags.amount), facts.decimals, "amount");
  } else {
    const held = await heldRaw(address, networkId);
    if (held <= 0n) throw new InvalidArgument(`You hold no ${symbol} on ${NETWORKS[networkId]}.`);
    raw = flags.all !== undefined ? held.toString() : shareOf(held, percentToBps(flags.percent));
    if (BigInt(raw) <= 0n) throw new InvalidArgument("That share rounds to nothing.");
  }

  const tokens = facts ? rawToDecimal(raw, facts.decimals) : `${raw} raw units of`;
  return { side, networkId, address, symbol, decimals, amountRaw: raw, spendText: `${tokens} ${symbol}`, evmAmount: raw, slippageBps };
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** The price check, through whichever route serves this chain. Reads only. */
async function quote(p: Plan): Promise<Record<string, unknown>> {
  if (isEvmNetwork(p.networkId)) {
    const path = p.side === "buy" ? "/evm/buy/preview" : "/evm/sell/preview";
    const body =
      p.side === "buy"
        ? { outputToken: p.address, amountUsdc: p.evmAmount, networkId: p.networkId, slippageBps: p.slippageBps }
        : { inputToken: p.address, amountMinor: String(p.evmAmount), networkId: p.networkId, slippageBps: p.slippageBps };
    return api(path, { method: "POST", body });
  }
  const [inputMint, outputMint] = p.side === "buy" ? [USDC_MINT, p.address] : [p.address, USDC_MINT];
  return api("/swap/quote", {
    method: "POST",
    body: { inputMint, outputMint, amountRaw: p.amountRaw, slippageBps: p.slippageBps },
  });
}

/**
 * One line on what comes back, from whichever fields this route's quote carries.
 *
 * ⚠️ THE TWO ROUTES ANSWER IN DIFFERENT UNITS. The Solana quote has `outAmountUI`, already
 * a human number. The EVM preview has `amountOut` in RAW units of the output token: USDC's
 * six decimals on a sell, the token's own on a buy. Printed as it came, a $0.91 sell read as
 * "about $911096". Converted here, or left out when the decimals are unknown.
 */
export function expectedText(p: Plan, q: Record<string, unknown>): string {
  if (q.outAmountUI !== undefined) {
    return p.side === "buy" ? `about ${String(q.outAmountUI)} ${p.symbol}` : `about $${String(q.outAmountUI)} USDC`;
  }
  const raw = typeof q.amountOut === "string" && /^\d+$/.test(q.amountOut) ? q.amountOut : null;
  if (!raw) return "";
  if (p.side === "sell") return `about $${rawToDecimal(raw, USDC_DECIMALS)} USDC`;
  return p.decimals == null ? "" : `about ${rawToDecimal(raw, p.decimals)} ${p.symbol}`;
}

async function execute(p: Plan, q: Record<string, unknown>): Promise<unknown> {
  if (isEvmNetwork(p.networkId)) {
    // One key per intent, so a retry after a timeout is recognised as the same trade.
    const idempotencyKey = `cli-${p.side}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return p.side === "buy"
      ? api("/evm/buy", {
          method: "POST",
          body: { outputToken: p.address, amountUsdc: p.evmAmount, networkId: p.networkId, slippageBps: p.slippageBps, idempotencyKey },
        })
      : api("/evm/sell", {
          method: "POST",
          body: { inputToken: p.address, amountMinor: String(p.evmAmount), networkId: p.networkId, slippageBps: p.slippageBps, idempotencyKey },
        });
  }
  const expectedOutRaw = typeof q.outputAmount === "string" ? q.outputAmount : undefined;
  return api(p.side === "buy" ? "/swap/buy" : "/swap/sell", {
    method: "POST",
    body: {
      token: p.address,
      amountRaw: p.amountRaw,
      slippageBps: p.slippageBps,
      // The amount the reader just agreed to. The server can refuse a route that has moved
      // far from it rather than fill at whatever it finds now.
      ...(expectedOutRaw ? { expectedOutRaw } : {}),
    },
  });
}

export async function runTrade(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return flags.help ? 0 : 1;
  }

  const common = ["address", "networkId", "slippage"];
  const ALLOWED: Record<string, readonly string[]> = {
    quote: [...common, "side", "usd", "percent", "amount", "all"],
    buy: [...common, "usd", "yes"],
    sell: [...common, "percent", "amount", "all", "yes"],
  };
  if (!ALLOWED[sub]) {
    process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
    return 1;
  }
  checkFlags(flags, ALLOWED[sub]!, `trade ${sub}`);

  if (sub === "quote") {
    const side = flags.side === "sell" ? "sell" : flags.side === "buy" || flags.side === undefined ? "buy" : null;
    if (!side) throw new InvalidArgument("--side is buy or sell");
    const p = await plan(side, flags);
    print({ side: p.side, chain: NETWORKS[p.networkId], spending: p.spendText, quote: await quote(p) }, flags);
    return 0;
  }

  const p = await plan(sub as "buy" | "sell", flags);
  // QUOTE BEFORE ASKING. A confirmation that cannot name what comes back is a formality.
  const q = await quote(p);
  const expected = expectedText(p, q);

  await confirm(
    `${p.side === "buy" ? "Buy" : "Sell"} on ${NETWORKS[p.networkId]}: spend ${p.spendText}` +
      `${expected ? `, receive ${expected}` : ""}` +
      `${p.slippageBps ? ` (slippage up to ${p.slippageBps / 100}%)` : ""}.\n` +
      `Token: ${p.address}\n` +
      `This sends a transaction from your wallet and cannot be recalled.`,
    flags,
  );

  const result = await execute(p, q);
  print({ submitted: true, side: p.side, chain: NETWORKS[p.networkId], spent: p.spendText, result }, flags);
  return 0;
}
