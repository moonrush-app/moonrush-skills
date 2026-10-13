import { api } from "../lib/api.js";
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

Your agent:
  status                Settings, open and closed positions, results, last decisions
  setup                 Create it, or change it. Paper by default. LIVE SPENDS MONEY.
  pause                 No new entries. Exits keep being managed.
  resume                Back to active.
  stop                  Sells everything it holds on its next minute. SELLS.
  watch add|remove|list Watch a Moonrush trader, or ANY Solana / EVM wallet in realtime
  telegram link|status|unlink   Get the agent's messages in Telegram
  sell --position <id>  Sell all of a position, or --pct 25|50|75. SELLS.
  add --position <id> --pct <10|25|50|100>   Buy more of it with that % of your cash.

Templates (rent someone's agent, paper for now):
  templates             Published agents and their results
  template show <slug>  One: its strategy in words, recent trades, what changed
  template follow <slug> --budget <usd>   Rent it: its strategy, your money. Paper.
  template leave        Stop following; keep its strategy and positions as your own
  publish --slug <s> --name <n> [--description <d>]   Publish your agent (reviewed first)
  publish update|unlist|relist|retire       Manage what you published

rank:       --window 7d|30d|90d (30d)  --sort score|pnl|winRate|profitFactor|drawdown
            --min-trades <n> (5)  --exclude bot,lucky,thin,deep_drawdown,bag_holder  --limit <n> (50)
traders:    --limit <n>                      1 to 100 (default 50)
activity:   --trader <@name|id> | --watchlist | --wallet <address> [--networkId <id|name>]
            (default: the pool; --wallet reads any wallet's on-chain buys and sells)
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

templates:  --sort return30d|return7d|renters (return30d)  --limit <n> (20)
            returns count every trade at 10% of the account, whatever the creator's budget
template follow: --budget <usd> (required)  --per-trade <pct>  --max-positions <n>  --daily-loss <usd>
            only money settings: the strategy and the watched wallets are the template's
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
      "wallet-window", "yes",
    ],
    "agent setup",
  );
  const mode = flags.mode === undefined ? undefined : parseChoice(flags.mode, "mode", ["paper", "live"] as const, "paper");

  const config: Record<string, number | boolean> = {};
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
  checkFlags(flags, ["sort", "limit"], "agent templates");
  const sort = parseChoice(flags.sort, "sort", ["return30d", "return7d", "renters"] as const, "return30d");
  const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 });
  print(await api(`/agent/templates?sort=${sort}&limit=${limit}`), flags);
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
    checkFlags(flags, ["budget", "per-trade", "max-positions", "daily-loss"], "agent template follow");
    const budgetUsd = num(flags, "budget", { min: 10, max: 100_000 });
    if (budgetUsd === undefined) throw new InvalidArgument("--budget is required: the paper money the agent starts with");
    const body: Record<string, unknown> = { slug: slugArg(slug, "template follow"), budgetUsd };
    const perTrade = pct(flags, "per-trade", 50);
    const maxPositions = num(flags, "max-positions", { min: 1, max: 20 });
    const dailyLoss = num(flags, "daily-loss", { min: 1, max: 100_000 });
    if (perTrade !== undefined) body.maxPositionPct = perTrade;
    if (maxPositions !== undefined) body.maxOpenPositions = maxPositions;
    if (dailyLoss !== undefined) body.maxDailyLossUsd = dailyLoss;
    print(await api("/agent/me/template", { method: "POST", body }), flags);
    return 0;
  }
  if (action === "leave") {
    checkFlags(flags, [], "agent template leave");
    print(await api("/agent/me/template", { method: "DELETE" }), flags);
    return 0;
  }
  throw new InvalidArgument("agent template is one of: show <slug>, follow <slug>, leave");
}

async function publish(action: string | undefined, flags: Flags): Promise<number> {
  if (action === undefined) {
    checkFlags(flags, ["slug", "name", "description"], "agent publish");
    const slug = typeof flags.slug === "string" ? flags.slug.trim().toLowerCase() : "";
    const name = typeof flags.name === "string" ? flags.name.trim() : "";
    if (!slug || !name) throw new InvalidArgument("--slug and --name are required");
    const description = typeof flags.description === "string" ? flags.description : undefined;
    print(
      await api("/agent/me/publish", { method: "POST", body: { slug, name, ...(description ? { description } : {}) }, envelope: true }),
      flags,
    );
    return 0;
  }
  if (action === "update") {
    checkFlags(flags, ["name", "description"], "agent publish update");
    const body: Record<string, string> = {};
    if (typeof flags.name === "string") body.name = flags.name;
    if (typeof flags.description === "string") body.description = flags.description;
    if (Object.keys(body).length === 0) throw new InvalidArgument("Pass --name and/or --description");
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

export async function runAgent(sub: string | undefined, flags: Flags, rest: string[] = []): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  switch (sub) {
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
      checkFlags(flags, ["trader", "watchlist", "wallet", "networkId", "hours", "limit"], "agent activity");
      if (typeof flags.wallet === "string") {
        // Any wallet, watched or not, straight from the on-chain index.
        const limit = parseInteger(flags.limit, "limit", { min: 1, max: 100, fallback: 30 });
        const net = flags.networkId === undefined ? "" : `&networkId=${parseNetworkId(flags.networkId)}`;
        print(
          await api(`/agent/wallet-activity?address=${encodeURIComponent(flags.wallet.trim())}&limit=${limit}${net}`, { envelope: true }),
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
    case "pause":
    case "resume":
    case "stop":
      return setStatus(sub, flags);
    default:
      process.stderr.write(`Unknown agent sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
