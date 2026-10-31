import { readFileSync, writeFileSync } from "node:fs";
import { api, setAgentScope } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import { InvalidArgument, checkFlags, parseChoice, parseInteger, parseNetworkId } from "../lib/validate.js";

const USAGE = `moonrush-cli agent <sub> [options]

The Moonrush trading agent: it follows a ranked pool of top traders, buys what
several of them agree on (or copies the wallets you watch), and manages the exit.
Trades Solana, Base, BNB, Robinhood and Arc. Runs on Moonrush's servers.

Building blocks (any key), for the hosted agent or your own:
  rank                  Every trader's record: win rate, profit factor, drawdown, hold
                        time, and bot / lucky / thin / deep_drawdown flags
  traders               The pool the hosted agent follows, with each trader's weight
  activity              "Trader X just bought / sold": the tracked feed
  consensus             Tokens several traders are buying now, your window and bar
  signals               The hosted agent's consensus signals: BUY, and EXIT

Your agents (one flow, one agent: each has its own money, positions, wallet and strategy):
  list                  Every agent of yours: status, mode, equity, PnL, open positions
  create --name <n> [--file f.json]   A new agent, paused on paper, with its own wallet. Its
                        strategy starts from the defaults, or from a flow file.
  rename <id> --name <n>
  delete <id> --yes     Only with no open positions, no USDC in its wallet, not published
  --agent <id|name>     On any command below: which agent. Without it, your first one.

One agent:
  status                Settings, open and closed positions, results, last decisions
  setup                 Create it, or change it. Paper by default. LIVE SPENDS MONEY.
  pause                 No new entries. Exits keep being managed.
  resume                Back to active.
  stop                  Sells everything it holds on its next minute. SELLS.
  watch add|remove|list Watch a Moonrush trader, or ANY Solana / EVM wallet in realtime
  telegram link|status|unlink   Get the agent's messages in Telegram
  key                           The API key in use: its scopes, and for an agent key its limits,
                                what it may still spend today, and its own wallet
  wallet [create]               An agent key's own wallets (Solana + EVM) and their cash; create
                                makes them. Its trades run from these, never your main wallet
  wallet withdraw [--usd <n>]   With the agent key: send its USDC back to your main wallet
                                (all when --usd is left out). Only ever to your main wallet.
  wallet fund --key <keyId> --usd <n>   With a trading key: move USDC from your main wallet
                                into that agent key's wallet. An agent key cannot fund itself.
  notify --text <message>       Send yourself a message in that Telegram (60 an hour), for a
                                runner you built: "bought X", "stopped out of Y"
  sell --position <id>  Sell all of a position, or --pct 25|50|75. SELLS.
  add --position <id> --pct <10|25|50|100>   Buy more of it with that % of your cash.
  token <address> [--chain <c>]   What buying a token would be: figures, filter warnings
  buy <address> --usd <n> [--chain <c>]   Buy a token by address (Solana or EVM). BUYS.
                        Your filters only warn here; the risk check and position limit refuse.
                        --chain: for an EVM address that is a token on several chains.

Templates (the marketplace: rent someone's agent, on paper or live):
  templates             Published agents and their results
  template show <slug>  One: its strategy in words, recent trades, what changed
  template follow <slug> --budget <usd>   Rent it: its strategy, your money. Paper, or live
                        if your agent is (you agree to the creator's fee first).
  template leave        Stop renting: your agent pauses, what it holds keeps its exits
  publish --slug <s> --name <n> [--description <d>] [--fee <pct>]   Publish your agent
                        (reviewed first). --fee: your share of a live renter's profit, 0 to 10.
  publish update [--fee <pct>] [--price <usd> --period once|monthly|free]|unlist|relist|retire
                        Manage what you published. --price: what renting costs on top of
                        the fee, all of it yours; --period free makes it free again.
  template cancel       Stop renewing a monthly rental (it runs to the end of the month paid)

Flows (draw your agent as nodes: triggers, filters, logic, data, Telegram, buy, exits):
  flow schema           Every node, its settings and bounds
  flow list             Your flows, each one an agent's strategy (agentId)
  flow new --name <n> [--file f.json]   New flow, and a paused agent for it (or, with --agent
                        on an agent that has none, that agent's strategy)
  flow get <id> [--out f.json]          A flow: its graph, errors, what it does in words
  flow put <id> --file f.json [--name n] Save; with errors it is kept as a draft
  flow test <id> [--file f.json]        The last 24h of signals through it, node by node
  flow backtest <id> [--days 7|30] [--file f.json]
                                        Past signals through it with a portfolio: trades,
                                        PnL, win rate, drawdown (exits played on candles)
  flow activate <id> | deactivate       --agent runs it, or its own settings again
  flow delete <id>

rank:       --window 7d|30d|90d (30d)  --sort score|pnl|winRate|profitFactor|drawdown
            --min-trades <n> (5)  --exclude bot,lucky,thin,deep_drawdown,bag_holder  --limit <n> (50)
traders:    --limit <n>                      1 to 100 (default 50)
activity:   --trader <@name|id> | --watchlist | --wallet <address> [--networkId <id|name>]
            (default: the pool; --wallet reads any wallet's on-chain buys and sells, with
            "holding": its median buy-to-sell time and whether that is a scalper's,
            under --min-hold <minutes>, default 10)
            --hours <n> (24)  --limit <n> (50)
consensus:  --watchlist  --window <hours> (6)  --min-traders <n> (2)  --min-score <0..1>
signals:    --kind buy|exit  --limit <n>     (default both, 30)
watch:      add|remove --trader <@name|id>
            add|remove --address <sol or 0x wallet> [--label <name>]
              realtime: each buy and sell is pushed (and sent to Telegram) within seconds

setup:
  --mode paper|live          paper books real quotes with no money moving (default)
  --budget <usd>             what it may have at work at once (default 100)
  --per-trade <pct>          largest entry as % of the budget (default 10)
  --max-positions <n>        open at once (default 5)
  --daily-loss <usd>         realized loss in a UTC day that pauses it (default 20)
  --tp <pct>                 take profit, % above entry (default 100)
  --sl <pct>                 stop loss, % below entry (default 30)
  --trail <pct>              trailing stop from the peak (default 25)
  --trail-arm <pct>          gain that arms the trailing stop (default 30)
  --max-hold <hours>         sell after this long (default 72)
  --min-liquidity <usd>      skip thinner pools (default 50000)
  --min-mcap <usd>           skip smaller tokens (default 100000)
  --min-traders <n>          stricter than the shared signal (default 0: use the signal's)
  --slippage <bps>           entries; exits may go wider to get out (default 300)
  --no-follow-exits          ignore EXIT signals, keep only TP/SL/trailing/time
  --networks <list>          chains it may trade: solana,base,bnb,robinhood,arc (default all)
  --copy-wallets             also copy the wallets you watch (agent watch add --address):
                             buy when they buy, sell when one you followed sells. Solana
                             and EVM, realtime. --no-copy-wallets turns it off.
  --wallet-min-agree <n>     how many watched wallets must buy the same token (default 1)
  --wallet-window <minutes>  inside how long (default 60)
  --min-wallet-buy <usd>     ignore a watched wallet's buy smaller than this (default 20)
  --max-chase <pct>          skip a copy when the price is already this % above what the
                             wallet paid (default 15)
  --no-mirror-sells          sell everything on a copied wallet's first sale, not its share
  --no-mirror-adds           do not buy more when a copied wallet buys more
  --max-adds <n>             adds per position when mirroring (default 2)
  --add-after <minutes>      no add until the position is this old (default 30, 0 = off)
  --add-below-entry          also add while the price is below the entry (default: only
                             while up). --no-add-below-entry turns it back off.
  --pause-after-losses <n>   pause a wallet after its last n copied trades all lost (default 3,
                             0 = never)
  --sizing conviction|fixed  size a copy by how big the buy is for that wallet (default), or
                             always the largest entry
  --tp-sell <pct>            share sold at the take profit, the rest rides (default 50;
                             100 sells everything)
  --breakeven <pct>          once up this much, a return to the entry sells (default 50; 0 off)
  --min-wallet-hold <min>    skip buys of a wallet whose median hold is under this (default 10;
                             0 off): a scalper is out before a copy is in
  --max-snipers <pct>        skip a token when snipers hold over this % of supply (default 20)
  --max-bundlers <pct>       ... bundlers (default 30)
  --max-dev <pct>            ... the developer (default 20)
  --min-holders <n>          skip a token with fewer holders (default 100)
  --min-age <minutes>        skip a token younger than this (default 30)
                             token filters apply only when Codex knows the figure

templates:  --sort return30d|return7d|renters|newest (return30d)  --limit <n> (20)
            --mode live|paper  --network <id|name>  --q <text>
            returns count every trade at 10% of the account, whatever the creator's budget
template follow: --budget <usd> (required)  --per-trade <pct>  --max-positions <n>  --daily-loss <usd>
            only money settings: the strategy and the watched wallets are the template's.
            An agent that trades live shows the consent, naming the creator's fee, and asks
            on a terminal first (--yes to agree without asking).
            The fee: a share of LIVE profit only, taken in USDC after a winning sale, and only
            on profit above the renter's previous best. Paper renting is free.
publish:    needs a few days of history and closed trades (the server says how many if short);
            listed after Moonrush reviews it

setup in live mode shows the consent text and asks on a terminal first; so do
resume of a live agent, and stop.
--yes skips the question and is for a person to type, never an agent.`;

type Flags = Record<string, string | true>;

interface AgentRow {
  mode: "paper" | "live";
  status: "active" | "paused" | "stopped";
}

interface Platform {
  agentsRunning: boolean;
  liveTradingEnabled: boolean;
  liveConsent: { version: string; text: string };
}

/** `/agent/me` carries `platform` beside `data`; read with the envelope kept. */
const platformOf = (r: unknown): Platform | undefined =>
  r && typeof r === "object" && "platform" in r ? (r as { platform?: Platform }).platform : undefined;
const agentOf = (r: unknown): AgentRow | null =>
  r && typeof r === "object" && "data" in r ? ((r as { data?: AgentRow | null }).data ?? null) : (r as AgentRow | null);

/** A positive number flag, or undefined when absent. */
function num(flags: Flags, name: string, { min, max }: { min: number; max: number }): number | undefined {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (raw === true || !Number.isFinite(n) || n < min || n > max) {
    throw new InvalidArgument(`--${name} must be a number from ${min} to ${max}, got: ${String(raw)}`);
  }
  return n;
}

const pct = (flags: Flags, name: string, max: number) => {
  const v = num(flags, name, { min: 0, max });
  return v === undefined ? undefined : v / 100;
};

async function current(): Promise<AgentRow | null> {
  return agentOf(await api<unknown>("/agent/me", { envelope: true }));
}

async function setup(flags: Flags): Promise<number> {
  checkFlags(
    flags,
    [
      "mode", "budget", "per-trade", "max-positions", "daily-loss", "tp", "sl", "trail",
      "trail-arm", "max-hold", "min-liquidity", "min-mcap", "min-traders", "slippage",
      "no-follow-exits", "networks", "copy-wallets", "no-copy-wallets", "wallet-min-agree",
      "wallet-window", "min-wallet-buy", "max-chase", "no-mirror-sells", "mirror-sells",
      "no-mirror-adds", "mirror-adds", "max-adds", "add-after", "add-below-entry", "no-add-below-entry",
      "pause-after-losses", "sizing", "tp-sell",
      "breakeven", "min-wallet-hold", "max-snipers", "max-bundlers", "max-dev", "min-holders",
      "min-age", "yes",
    ],
    "agent setup",
  );
  const mode = flags.mode === undefined ? undefined : parseChoice(flags.mode, "mode", ["paper", "live"] as const, "paper");

  const config: Record<string, number | boolean | string> = {};
  const put = (key: string, v: number | undefined) => {
    if (v !== undefined) config[key] = v;
  };
  put("budgetUsd", num(flags, "budget", { min: 10, max: 100_000 }));
  put("maxPositionPct", pct(flags, "per-trade", 50));
  put("maxOpenPositions", num(flags, "max-positions", { min: 1, max: 20 }));
  put("maxDailyLossUsd", num(flags, "daily-loss", { min: 1, max: 100_000 }));
  put("takeProfitPct", pct(flags, "tp", 2_000));
  put("stopLossPct", pct(flags, "sl", 95));
  put("trailPct", pct(flags, "trail", 95));
  put("trailArmPct", pct(flags, "trail-arm", 2_000));
  put("maxHoldHours", num(flags, "max-hold", { min: 1, max: 720 }));
  put("minLiquidityUsd", num(flags, "min-liquidity", { min: 0, max: 100_000_000 }));
  put("minMarketCapUsd", num(flags, "min-mcap", { min: 0, max: 100_000_000_000 }));
  put("minSignalTraders", num(flags, "min-traders", { min: 0, max: 50 }));
  put("maxSlippageBps", num(flags, "slippage", { min: 10, max: 2_000 }));
  if (flags["no-follow-exits"]) config.followExits = false;
  if (flags["copy-wallets"]) config.copyWallets = true;
  if (flags["no-copy-wallets"]) config.copyWallets = false;
  put("walletMinAgree", num(flags, "wallet-min-agree", { min: 1, max: 20 }));
  put("walletWindowMin", num(flags, "wallet-window", { min: 5, max: 1440 }));
  put("walletMinBuyUsd", num(flags, "min-wallet-buy", { min: 0, max: 1_000_000 }));
  put("maxChasePct", pct(flags, "max-chase", 1_000));
  if (flags.sizing !== undefined) {
    config.walletSizing = parseChoice(flags.sizing, "sizing", ["conviction", "fixed"] as const, "conviction");
  }
  if (flags["no-mirror-sells"]) config.mirrorSells = false;
  if (flags["mirror-sells"]) config.mirrorSells = true;
  if (flags["no-mirror-adds"]) config.mirrorAdds = false;
  if (flags["mirror-adds"]) config.mirrorAdds = true;
  put("maxAdds", num(flags, "max-adds", { min: 0, max: 10 }));
  put("addMinAgeMin", num(flags, "add-after", { min: 0, max: 10_080 }));
  if (flags["add-below-entry"]) config.addOnlyInProfit = false;
  if (flags["no-add-below-entry"]) config.addOnlyInProfit = true;
  put("walletPauseAfterLosses", num(flags, "pause-after-losses", { min: 0, max: 50 }));
  put("takeProfitSellPct", pct(flags, "tp-sell", 100));
  put("breakevenAfterPct", pct(flags, "breakeven", 2_000));
  put("walletMinHoldMin", num(flags, "min-wallet-hold", { min: 0, max: 10_080 }));
  // Percent of supply is sent as a percent (20 = 20%), as Codex reports it.
  put("maxSniperPct", num(flags, "max-snipers", { min: 0, max: 100 }));
  put("maxBundlerPct", num(flags, "max-bundlers", { min: 0, max: 100 }));
  put("maxDevPct", num(flags, "max-dev", { min: 0, max: 100 }));
  const holders = num(flags, "min-holders", { min: 0, max: 1_000_000 });
  put("minHolders", holders === undefined ? undefined : Math.round(holders));
  put("minTokenAgeMin", num(flags, "min-age", { min: 0, max: 525_600 }));
  const networks =
    typeof flags.networks === "string"
      ? flags.networks.split(",").map((n) => n.trim()).filter(Boolean).map((n) => parseNetworkId(n))
      : undefined;
  if (networks) {
    const allowed = [1399811149, 8453, 56, 4663, 5042];
    const bad = networks.filter((n) => !allowed.includes(n));
    if (bad.length) {
      throw new InvalidArgument(`--networks takes solana, base, bnb, robinhood, arc. Not tradable by the agent: ${bad.join(", ")}`);
    }
  }

  const me = await api<{ data?: AgentRow | null; platform?: Platform } | AgentRow | null>("/agent/me", { envelope: true });
  const platform = platformOf(me);
  const consent: Record<string, unknown> = {};
  if (mode === "live" && platform?.liveConsent) {
    // The exact wording the server will record, shown in full: this is the user agreeing to
    // let software spend their money, and they must see what they agree to.
    await confirm(
      `${platform.liveConsent.text}\n\n` +
        `Limits: ${JSON.stringify(config)}` +
        (platform.liveTradingEnabled ? "" : "\n(Moonrush has live trading switched off right now: the agent will refuse to buy until it is on.)"),
      flags,
      "this lets the agent spend your money",
    );
    consent.consent = true;
    consent.consentVersion = platform.liveConsent.version;
  } else if (mode === "live") {
    throw new InvalidArgument("The server did not send the live-trading consent text; refusing to go live without it.");
  }
  print(
    await api("/agent/me", {
      method: "POST",
      body: { ...(mode ? { mode } : {}), config: { ...config, ...(networks ? { networks } : {}) }, ...consent },
    }),
    flags,
  );
  return 0;
}

async function setStatus(action: "pause" | "resume" | "stop", flags: Flags): Promise<number> {
  checkFlags(flags, ["yes"], `agent ${action}`);
  const agent = await current();
  if (!agent) throw new InvalidArgument("No agent yet. Create one with: moonrush-cli agent setup");
  if (action === "stop") {
    await confirm(
      `Stopping sells every position the agent holds${agent.mode === "live" ? " from your wallet" : " (paper)"} on its next minute.`,
      flags,
      agent.mode === "live" ? "this moves money" : "this closes the agent's positions",
    );
  }
  if (action === "resume" && agent.mode === "live") {
    await confirm("Resuming lets the live agent spend your wallet's USDC again.", flags, "this lets the agent spend your money");
  }
  print(await api(`/agent/me/${action}`, { method: "POST" }), flags);
  return 0;
}

const FLAGS = ["bot", "lucky", "thin", "deep_drawdown", "bag_holder"];

function traderArg(flags: Flags): string {
  const t = typeof flags.trader === "string" ? flags.trader.trim() : "";
  if (!t) throw new InvalidArgument("--trader is required: a username (@name) or a user id");
  return t;
}

/**
 * Two kinds of watch, one command. `--trader` is a Moonrush profile (feed every ~2 minutes, and
 * in the consensus). `--address` is ANY Solana or EVM wallet, realtime: every buy and sell it
 * makes is pushed within seconds of the block.
 */
async function watch(action: string | undefined, flags: Flags): Promise<number> {
  checkFlags(flags, ["trader", "address", "label"], `agent watch ${action ?? ""}`.trim());
  const address = typeof flags.address === "string" ? flags.address.trim() : "";
  if (action === "list" || action === undefined) {
    const [traders, wallets] = await Promise.all([api("/agent/me/watchlist"), api("/agent/me/wallets")]);
    print({ traders, wallets }, flags);
    return 0;
  }
  if (action === "add") {
    if (address) {
      const label = typeof flags.label === "string" ? flags.label : undefined;
      print(await api("/agent/me/wallets", { method: "POST", body: { address, ...(label ? { label } : {}) } }), flags);
    } else {
      print(await api("/agent/me/watchlist", { method: "POST", body: { trader: traderArg(flags) } }), flags);
    }
    return 0;
  }
  if (action === "remove") {
    if (address) print(await api(`/agent/me/wallets/${encodeURIComponent(address)}`, { method: "DELETE" }), flags);
    else print(await api(`/agent/me/watchlist/${encodeURIComponent(traderArg(flags))}`, { method: "DELETE" }), flags);
    return 0;
  }
  throw new InvalidArgument("agent watch is one of: list, add, remove");
}

async function telegram(action: string | undefined, flags: Flags): Promise<number> {
  checkFlags(flags, [], `agent telegram ${action ?? ""}`.trim());
  if (action === "status" || action === undefined) {
    print(await api("/agent/me/telegram"), flags);
    return 0;
  }
  if (action === "link") {
    print(await api("/agent/me/telegram/link", { method: "POST" }), flags);
    return 0;
  }
  if (action === "unlink") {
    print(await api("/agent/me/telegram", { method: "DELETE" }), flags);
    return 0;
  }
  throw new InvalidArgument("agent telegram is one of: status, link, unlink");
}

async function templates(flags: Flags): Promise<number> {
  checkFlags(flags, ["sort", "limit", "mode", "network", "q"], "agent templates");
  const sort = parseChoice(flags.sort, "sort", ["return30d", "return7d", "renters", "newest"] as const, "return30d");
  const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 });
  const qs = new URLSearchParams({ sort, limit: String(limit) });
  if (flags.mode !== undefined) qs.set("mode", parseChoice(flags.mode, "mode", ["live", "paper"] as const, "live"));
  if (typeof flags.network === "string") qs.set("network", String(parseNetworkId(flags.network)));
  if (typeof flags.q === "string" && flags.q.trim()) qs.set("q", flags.q.trim());
  print(await api(`/agent/templates?${qs.toString()}`), flags);
  return 0;
}

function slugArg(slug: string | undefined, what: string): string {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) throw new InvalidArgument(`${what} needs a template slug, e.g. moonrush-cli agent ${what} copy-6-wallets`);
  return s;
}

async function template(action: string | undefined, slug: string | undefined, flags: Flags): Promise<number> {
  if (action === "show") {
    checkFlags(flags, [], "agent template show");
    print(await api(`/agent/templates/${encodeURIComponent(slugArg(slug, "template show"))}`), flags);
    return 0;
  }
  if (action === "follow") {
    checkFlags(flags, ["budget", "per-trade", "max-positions", "daily-loss", "yes"], "agent template follow");
    const budgetUsd = num(flags, "budget", { min: 10, max: 100_000 });
    if (budgetUsd === undefined) throw new InvalidArgument("--budget is required: the paper money the agent starts with");
    const body: Record<string, unknown> = { slug: slugArg(slug, "template follow"), budgetUsd };
    const perTrade = pct(flags, "per-trade", 50);
    const maxPositions = num(flags, "max-positions", { min: 1, max: 20 });
    const dailyLoss = num(flags, "daily-loss", { min: 1, max: 100_000 });
    if (perTrade !== undefined) body.maxPositionPct = perTrade;
    if (maxPositions !== undefined) body.maxOpenPositions = maxPositions;
    if (dailyLoss !== undefined) body.maxDailyLossUsd = dailyLoss;
    // A priced template is paid from the main wallet, which an API key never touches: the
    // owner pays on the web, then this command (or the web) rents it.
    const priced = await api<{ priceUsd?: number | null; pricePeriod?: string | null; slug?: string }>(
      `/agent/templates/${encodeURIComponent(String(body.slug))}`,
    );
    if (priced?.priceUsd && priced.pricePeriod) {
      const mine = agentOf(await api<unknown>("/agent/me", { envelope: true })) as (AgentRow & { rental?: { active?: boolean }; template?: { slug?: string } }) | null;
      if (!(mine?.template?.slug === body.slug && mine?.rental?.active)) {
        throw new InvalidArgument(
          `This template costs $${priced.pricePeriod === "once" ? `${priced.priceUsd} once` : `${priced.priceUsd} a month`}, paid from your Moonrush wallet. ` +
            `Pay on the web: https://moonrush.space/ai/agents/${body.slug}`,
        );
      }
    }
    // A live agent starts paying this creator's fee on its next profitable sale: the owner
    // sees the consent, with the fee named, and agrees to it before the server will rent.
    const me = await api<unknown>("/agent/me", { envelope: true });
    const mine = agentOf(me);
    if (mine?.mode === "live") {
      const platform = platformOf(me);
      if (!platform?.liveConsent) throw new InvalidArgument("The server did not send the live-trading consent text; refusing to rent live without it.");
      const t = await api<{ name?: string; feeBps?: number; creator?: { username?: string } }>(`/agent/templates/${encodeURIComponent(String(body.slug))}`);
      const fee = t?.feeBps ?? 0;
      await confirm(
        `Your agent trades live. Renting "${t?.name ?? body.slug}" means ` +
          (fee > 0
            ? `paying @${t?.creator?.username ?? "its creator"} ${+(fee / 100).toFixed(2)}% of your live profit, above your previous best.`
            : "following its strategy; its creator charges no fee.") +
          `\n\n${platform.liveConsent.text}`,
        flags,
        "this rents the template with real money",
      );
      body.consent = true;
      body.consentVersion = platform.liveConsent.version;
    }
    print(await api("/agent/me/template", { method: "POST", body }), flags);
    return 0;
  }
  if (action === "cancel") {
    checkFlags(flags, [], "agent template cancel");
    print(await api("/agent/me/template/cancel", { method: "POST" }), flags);
    return 0;
  }
  if (action === "leave") {
    checkFlags(flags, [], "agent template leave");
    print(await api("/agent/me/template", { method: "DELETE" }), flags);
    return 0;
  }
  throw new InvalidArgument("agent template is one of: show <slug>, follow <slug>, cancel, leave");
}

/** --price and --period: what renting costs, or free. Absent: unchanged. */
function priceFlags(flags: Flags): Record<string, unknown> | undefined {
  if (flags.price === undefined && flags.period === undefined) return undefined;
  const period = parseChoice(flags.period, "period", ["once", "monthly", "free"] as const, "monthly");
  if (period === "free") return { priceUsd: null, pricePeriod: null };
  const price = num(flags, "price", { min: 1, max: 10_000 });
  if (price === undefined) throw new InvalidArgument("--price <usd> is required with --period once|monthly");
  return { priceUsd: price, pricePeriod: period };
}

/** --fee in percent of a renter's profit (0 to 10), sent as bps. */
function feeFlag(flags: Flags): number | undefined {
  const v = num(flags, "fee", { min: 0, max: 10 });
  return v === undefined ? undefined : Math.round(v * 100);
}

async function publish(action: string | undefined, flags: Flags): Promise<number> {
  if (action === undefined) {
    checkFlags(flags, ["slug", "name", "description", "fee", "price", "period"], "agent publish");
    const slug = typeof flags.slug === "string" ? flags.slug.trim().toLowerCase() : "";
    const name = typeof flags.name === "string" ? flags.name.trim() : "";
    if (!slug || !name) throw new InvalidArgument("--slug and --name are required");
    const description = typeof flags.description === "string" ? flags.description : undefined;
    const feeBps = feeFlag(flags);
    print(
      await api("/agent/me/publish", {
        method: "POST",
        body: { slug, name, ...(description ? { description } : {}), ...(feeBps !== undefined ? { feeBps } : {}), ...(priceFlags(flags) ?? {}) },
        envelope: true,
      }),
      flags,
    );
    return 0;
  }
  if (action === "update") {
    checkFlags(flags, ["name", "description", "fee", "price", "period"], "agent publish update");
    const body: Record<string, string | number> = {};
    if (typeof flags.name === "string") body.name = flags.name;
    if (typeof flags.description === "string") body.description = flags.description;
    const feeBps = feeFlag(flags);
    if (feeBps !== undefined) body.feeBps = feeBps;
    const price = priceFlags(flags);
    if (price) Object.assign(body, price);
    if (Object.keys(body).length === 0) throw new InvalidArgument("Pass --name, --description, --fee and/or --price/--period");
    print(await api("/agent/me/publish", { method: "PATCH", body }), flags);
    return 0;
  }
  if (action === "unlist" || action === "relist" || action === "retire") {
    checkFlags(flags, ["yes"], `agent publish ${action}`);
    if (action === "retire") {
      await confirm(
        "Retiring closes your template for good. Everyone renting it keeps its current strategy as their own.",
        flags,
        "this ends your template",
      );
    }
    print(await api(`/agent/me/publish/${action}`, { method: "POST" }), flags);
    return 0;
  }
  throw new InvalidArgument("agent publish takes --slug/--name, or one of: update, unlist, relist, retire");
}

/** An agent drawn as nodes. The rules are the server's; this reads and writes the JSON. */
async function flow(action: string | undefined, id: string | undefined, flags: Flags): Promise<number> {
  const needId = (what: string) => {
    const v = (id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(v)) throw new InvalidArgument(`agent flow ${what} <id>: an id from \`moonrush-cli agent flow list\``);
    return v;
  };
  const graphFrom = (file: unknown) => {
    if (typeof file !== "string") return undefined;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new InvalidArgument(`--file ${file}: ${e instanceof Error ? e.message : "not JSON"}`);
    }
  };
  switch (action) {
    case "schema":
      checkFlags(flags, [], "agent flow schema");
      print(await api("/agent/flow-schema"), flags);
      return 0;
    case "list":
    case undefined:
      checkFlags(flags, [], "agent flow list");
      print(await api("/agent/me/flows"), flags);
      return 0;
    case "new": {
      checkFlags(flags, ["name", "file"], "agent flow new");
      const name = typeof flags.name === "string" ? flags.name.trim() : "";
      if (!name) throw new InvalidArgument("agent flow new --name <name> [--file flow.json]");
      const graph = graphFrom(flags.file);
      print(await api("/agent/me/flows", { method: "POST", body: { name, ...(graph ? { graph } : {}) } }), flags);
      return 0;
    }
    case "get": {
      checkFlags(flags, ["out"], "agent flow get");
      const f = await api<{ graph?: unknown }>(`/agent/me/flows/${needId("get")}`);
      if (typeof flags.out === "string") {
        writeFileSync(flags.out, JSON.stringify(f?.graph ?? null, null, 2));
        print({ wrote: flags.out }, flags);
      } else print(f, flags);
      return 0;
    }
    case "put": {
      checkFlags(flags, ["file", "name"], "agent flow put");
      const graph = graphFrom(flags.file);
      if (!graph) throw new InvalidArgument("agent flow put <id> --file flow.json");
      const name = typeof flags.name === "string" ? flags.name.trim() : undefined;
      print(await api(`/agent/me/flows/${needId("put")}`, { method: "PUT", body: { graph, ...(name ? { name } : {}) } }), flags);
      return 0;
    }
    case "test": {
      checkFlags(flags, ["file"], "agent flow test");
      const graph = graphFrom(flags.file);
      print(await api(`/agent/me/flows/${needId("test")}/test`, { method: "POST", body: graph ? { graph } : {} }), flags);
      return 0;
    }
    case "backtest": {
      checkFlags(flags, ["file", "days"], "agent flow backtest");
      const days = flags.days === undefined ? 7 : Number(flags.days);
      if (days !== 7 && days !== 30) throw new InvalidArgument("--days is 7 or 30");
      const graph = graphFrom(flags.file);
      print(await api(`/agent/me/flows/${needId("backtest")}/backtest`, { method: "POST", body: { days, ...(graph ? { graph } : {}) } }), flags);
      return 0;
    }
    case "activate":
      checkFlags(flags, [], "agent flow activate");
      print(await api(`/agent/me/flows/${needId("activate")}/activate`, { method: "POST" }), flags);
      return 0;
    case "deactivate":
      checkFlags(flags, [], "agent flow deactivate");
      print(await api("/agent/me/flows/deactivate", { method: "POST" }), flags);
      return 0;
    case "delete":
      checkFlags(flags, ["yes"], "agent flow delete");
      await confirm("Delete this flow for good.", flags, "this deletes a flow");
      print(await api(`/agent/me/flows/${needId("delete")}`, { method: "DELETE" }), flags);
      return 0;
    default:
      throw new InvalidArgument("agent flow is one of: schema, list, new, get, put, test, activate, deactivate, delete");
  }
}

/** Sell all or part of a position, or add to it, as the Telegram buttons do. */
async function trade(side: "sell" | "buy", flags: Flags): Promise<number> {
  checkFlags(flags, ["position", "pct", "yes"], side === "sell" ? "agent sell" : "agent add");
  const position = typeof flags.position === "string" ? flags.position.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(position)) {
    throw new InvalidArgument("--position is required: a position id from `moonrush-cli agent status`");
  }
  const allowed = side === "sell" ? [25, 50, 75, 100] : [10, 25, 50, 100];
  const pctValue =
    flags.pct === undefined && side === "sell" ? 100 : parseInteger(flags.pct, "pct", { min: 1, max: 100, fallback: 0 });
  if (!allowed.includes(pctValue)) throw new InvalidArgument(`--pct is one of ${allowed.join(", ")}`);
  const agent = await current();
  if (!agent) throw new InvalidArgument("No agent yet.");
  if (agent.mode === "live") {
    await confirm(
      side === "sell" ? `Sell ${pctValue}% of this position from your wallet.` : `Buy more with ${pctValue}% of your wallet's USDC.`,
      flags,
      "this moves money",
    );
  }
  print(await api(`/agent/me/positions/${position}/trade`, { method: "POST", body: { side, pct: pctValue }, envelope: true }), flags);
  return 0;
}

interface TokenPreview {
  ok: boolean;
  message?: string;
  choices?: { networkId: number; symbol: string | null; liquidityUsd: number | null }[];
  token?: { networkId: number; address: string; symbol: string | null };
  warnings?: { key: string; value: number; limit: number }[];
  blocked?: string | null;
  mode?: "paper" | "live";
}

async function previewOf(address: string, flags: Flags): Promise<TokenPreview> {
  const chain = flags.chain === undefined ? "" : `&networkId=${parseNetworkId(String(flags.chain))}`;
  const r = await api<unknown>(`/agent/me/token?address=${encodeURIComponent(address)}${chain}`, { envelope: true });
  return ((r && typeof r === "object" && "data" in r ? (r as { data?: TokenPreview }).data : r) ?? { ok: false }) as TokenPreview;
}

async function tokenPreview(address: string | undefined, flags: Flags): Promise<number> {
  checkFlags(flags, ["chain"], "agent token");
  if (!address) throw new InvalidArgument("agent token <address>: a Solana or EVM token address");
  print(await previewOf(address, flags), flags);
  return 0;
}

async function buyByAddress(address: string | undefined, flags: Flags): Promise<number> {
  checkFlags(flags, ["usd", "chain", "yes"], "agent buy");
  if (!address) throw new InvalidArgument("agent buy <address> --usd <n>: a Solana or EVM token address");
  const usd = num(flags, "usd", { min: 1, max: 1_000_000 });
  if (usd === undefined) throw new InvalidArgument("--usd is required: how many dollars to buy");
  const p = await previewOf(address, flags);
  if (!p.ok) throw new InvalidArgument(p.message ?? "Could not look up that token");
  if (!p.token) {
    const list = (p.choices ?? []).map((c) => `${c.networkId} (${c.symbol ?? "?"})`).join(", ");
    throw new InvalidArgument(`That address is a token on several chains: ${list}. Pick one with --chain.`);
  }
  if (p.blocked) throw new InvalidArgument(p.blocked);
  for (const w of p.warnings ?? []) {
    process.stderr.write(`warning: outside your auto-trading filters: ${w.key} ${w.value} (limit ${w.limit})\n`);
  }
  if (p.mode === "live") {
    await confirm(`Buy $${usd} of ${p.token.symbol ?? p.token.address} from your wallet.`, flags, "this moves money");
  }
  print(
    await api("/agent/me/positions", {
      method: "POST",
      body: { networkId: p.token.networkId, tokenAddress: p.token.address, usd },
      envelope: true,
    }),
    flags,
  );
  return 0;
}

interface AgentSummary {
  id: string;
  name: string;
  status: string;
  mode: string;
  rented: { slug: string; name: string; creator: string } | null;
  stats: { openPositions: number; realizedPnlUsd: number; unrealizedPnlUsd: number; equityUsd: number | null };
}

const UUID = /^[0-9a-f-]{36}$/i;

/** `--agent` as given: an id, or a name matched against the caller's agents. */
async function resolveAgent(given: string): Promise<string> {
  if (UUID.test(given)) return given;
  const all = await api<AgentSummary[]>("/agent/me/agents");
  const hit = all.filter((a) => a.name.toLowerCase() === given.toLowerCase());
  if (hit.length === 1) return hit[0]!.id;
  throw new InvalidArgument(
    hit.length > 1
      ? `Several agents are named "${given}": pass its id (agent list).`
      : `No agent named "${given}". Yours: ${all.map((a) => `${a.name} (${a.id})`).join(", ") || "none"}`,
  );
}

async function agents(action: string, rest: string[], flags: Flags): Promise<number> {
  if (action === "list") {
    checkFlags(flags, [], "agent list");
    print(await api("/agent/me/agents"), flags);
    return 0;
  }
  if (action === "create") {
    checkFlags(flags, ["name", "file"], "agent create");
    const name = typeof flags.name === "string" ? flags.name.trim() : "";
    if (!name) throw new InvalidArgument("--name is required");
    let graph: unknown;
    if (typeof flags.file === "string") {
      try {
        // An export from the web editor is { name, graph }; a bare graph works too.
        const doc = JSON.parse(readFileSync(flags.file, "utf8")) as { graph?: unknown };
        graph = doc.graph ?? doc;
      } catch (e) {
        throw new InvalidArgument(`--file ${flags.file}: ${e instanceof Error ? e.message : "not JSON"}`);
      }
    }
    print(await api("/agent/me/agents", { method: "POST", body: { name, ...(graph ? { graph } : {}) } }), flags);
    return 0;
  }
  const id = rest[0];
  if (!id) throw new InvalidArgument(`agent ${action} <id|name>`);
  const agentId = await resolveAgent(id);
  if (action === "rename") {
    checkFlags(flags, ["name"], "agent rename");
    if (typeof flags.name !== "string" || !flags.name.trim()) throw new InvalidArgument("--name is required");
    print(await api(`/agent/me/agents/${agentId}`, { method: "PATCH", body: { name: flags.name.trim() } }), flags);
    return 0;
  }
  checkFlags(flags, ["yes"], "agent delete");
  await confirm(`Delete agent ${id}, its strategy and its history? This cannot be undone.`, flags, "this deletes an agent");
  print(await api(`/agent/me/agents/${agentId}`, { method: "DELETE" }), flags);
  return 0;
}

export async function runAgent(sub: string | undefined, flags: Flags, rest: string[] = []): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  // Which agent: taken off the flags here, so no command has to allow it.
  if (flags.agent !== undefined) {
    if (typeof flags.agent !== "string") throw new InvalidArgument("--agent <id|name>");
    setAgentScope(await resolveAgent(flags.agent));
    delete flags.agent;
  }
  switch (sub) {
    case "list":
    case "create":
    case "rename":
    case "delete":
      return agents(sub, rest, flags);
    case "rank": {
      checkFlags(flags, ["window", "sort", "min-trades", "exclude", "limit"], "agent rank");
      const window = parseChoice(flags.window, "window", ["7d", "30d", "90d"] as const, "30d");
      const sort = parseChoice(flags.sort, "sort", ["score", "pnl", "winRate", "profitFactor", "drawdown"] as const, "score");
      const minTrades = parseInteger(flags["min-trades"], "min-trades", { min: 1, max: 500, fallback: 5 });
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 200, fallback: 50 });
      let exclude = "";
      if (typeof flags.exclude === "string") {
        const bad = flags.exclude.split(",").filter((f) => !FLAGS.includes(f.trim()));
        if (bad.length) throw new InvalidArgument(`--exclude takes: ${FLAGS.join(", ")}. Got: ${bad.join(", ")}`);
        exclude = `&exclude=${encodeURIComponent(flags.exclude)}`;
      }
      print(await api(`/agent/rank?window=${window}&sort=${sort}&minTrades=${minTrades}&limit=${limit}${exclude}`), flags);
      return 0;
    }
    case "activity": {
      checkFlags(flags, ["trader", "watchlist", "wallet", "networkId", "hours", "limit", "min-hold"], "agent activity");
      if (typeof flags.wallet === "string") {
        // Any wallet, watched or not, straight from the on-chain index.
        const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 30 });
        const net = flags.networkId === undefined ? "" : `&networkId=${parseNetworkId(flags.networkId)}`;
        const minHold = num(flags, "min-hold", { min: 0, max: 10_080 });
        const hold = minHold === undefined ? "" : `&minHoldMin=${minHold}`;
        print(
          await api(`/agent/wallet-activity?address=${encodeURIComponent(flags.wallet.trim())}&limit=${limit}${net}${hold}`, { envelope: true }),
          flags,
        );
        return 0;
      }
      const hours = parseInteger(flags.hours, "hours", { min: 1, max: 24 * 30, fallback: 24 });
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 200, fallback: 50 });
      const since = Math.floor(Date.now() / 1000) - hours * 3600;
      const who =
        typeof flags.trader === "string"
          ? `&trader=${encodeURIComponent(flags.trader)}`
          : flags.watchlist
            ? "&source=watchlist"
            : "&source=pool";
      print(await api(`/agent/activity?since=${since}&limit=${limit}${who}`, { envelope: true }), flags);
      return 0;
    }
    case "consensus": {
      checkFlags(flags, ["watchlist", "window", "min-traders", "min-score"], "agent consensus");
      const window = num(flags, "window", { min: 0.25, max: 24 }) ?? 6;
      const minTraders = parseInteger(flags["min-traders"], "min-traders", { min: 1, max: 50, fallback: 2 });
      const minScore = num(flags, "min-score", { min: 0, max: 1 });
      const q =
        `source=${flags.watchlist ? "watchlist" : "pool"}&windowHours=${window}&minTraders=${minTraders}` +
        (minScore !== undefined ? `&minScore=${minScore}` : "");
      print(await api(`/agent/consensus?${q}`), flags);
      return 0;
    }
    case "watch":
      return watch(rest[0], flags);
    case "telegram":
      return telegram(rest[0], flags);
    case "key":
      checkFlags(flags, [], "agent key");
      print(await api("/agent/me/key", { envelope: true }), flags);
      return 0;
    case "wallet": {
      const action = rest[0];
      if (action === "fund" || action === "withdraw") {
        checkFlags(flags, action === "fund" ? ["key", "usd", "yes"] : ["key", "usd", "yes"], `agent wallet ${action}`);
        const usd = num(flags, "usd", { min: 1, max: 100_000 });
        if (action === "fund" && usd === undefined) throw new InvalidArgument("agent wallet fund --key <keyId> --usd <n>");
        const key = typeof flags.key === "string" ? flags.key.trim() : "";
        if (action === "fund" && !key) throw new InvalidArgument("agent wallet fund needs --key <keyId>: the agent key to fund");
        const path = key ? `/agent/keys/${encodeURIComponent(key)}/wallet/${action}` : "/agent/me/key/wallet/withdraw";
        await confirm(
          action === "fund"
            ? `Move $${usd} USDC from your main wallet into agent key ${key}'s wallet. Transfer fees come out of it.`
            : `Send ${usd === undefined ? "all of the agent wallet's" : `$${usd} of the agent wallet's`} USDC back to your main wallet.`,
          flags,
          "this moves money",
        );
        print(await api(path, { method: "POST", body: usd === undefined ? {} : { usd }, envelope: true }), flags);
        return 0;
      }
      checkFlags(flags, [], "agent wallet");
      if (action !== undefined && action !== "create") throw new InvalidArgument("agent wallet [create|fund|withdraw]");
      print(await api("/agent/me/key/wallet", { method: action === "create" ? "POST" : "GET", envelope: true }), flags);
      return 0;
    }
    case "flow":
      return flow(rest[0], rest[1], flags);
    case "notify": {
      checkFlags(flags, ["text"], "agent notify");
      const text = typeof flags.text === "string" ? flags.text.trim() : "";
      if (!text) throw new InvalidArgument("agent notify --text <message>");
      print(await api("/agent/me/notify", { method: "POST", body: { text }, envelope: true }), flags);
      return 0;
    }
    case "traders": {
      checkFlags(flags, ["limit"], "agent traders");
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 50 });
      print(await api(`/agent/traders?limit=${limit}`), flags);
      return 0;
    }
    case "signals": {
      checkFlags(flags, ["kind", "limit"], "agent signals");
      const kind = flags.kind === undefined ? undefined : parseChoice(flags.kind, "kind", ["buy", "exit"] as const, "buy");
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 30 });
      print(await api(`/agent/signals?limit=${limit}${kind ? `&kind=${kind.toUpperCase()}` : ""}`), flags);
      return 0;
    }
    case "status":
      checkFlags(flags, [], "agent status");
      // The whole body: `platform` says whether Moonrush is running agents and allows live money.
      print(await api("/agent/me", { envelope: true }), flags);
      return 0;
    case "setup":
      return setup(flags);
    case "templates":
      return templates(flags);
    case "template":
      return template(rest[0], rest[1], flags);
    case "publish":
      return publish(rest[0], flags);
    case "sell":
      return trade("sell", flags);
    case "add":
      return trade("buy", flags);
    case "token":
      return tokenPreview(rest[0], flags);
    case "buy":
      return buyByAddress(rest[0], flags);
    case "pause":
    case "resume":
    case "stop":
      return setStatus(sub, flags);
    default:
      process.stderr.write(`Unknown agent sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
