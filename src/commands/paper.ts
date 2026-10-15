import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { InvalidArgument, checkFlags, parseInteger, parseNetworkId, requireAddress } from "../lib/validate.js";

const USAGE = `moonrush-cli paper <sub> [options]

Play money for building and testing an agent: real quotes through the same routes a trade
takes, nothing signed, nothing moved. One account per API key, $1,000 to start, 200 trades a
UTC day.

  status                                   Cash, positions at today's price, results
  buy  --address <token> --usd <n>         A paper buy
  sell --address <token> --percent <p>|--all   A paper sell of what the account holds
  fills [--limit 50]                       Paper trades since the last reset, newest first
  reset                                    Back to $1,000 and nothing held

  --networkId <id|name>   solana (default), base, bnb, robinhood, arc

\`trade buy|sell --paper\` does the same as paper buy|sell. Standing orders on paper:
\`orders create|list|cancel --paper\` (limit, tp, sl, trailing; checked each minute).`;

type Flags = Record<string, string | true>;

export async function paperBuy(flags: Flags): Promise<unknown> {
  const networkId = parseNetworkId(flags.networkId);
  const token = requireAddress(flags.address, networkId);
  const usd = Number(flags.usd);
  if (flags.usd === undefined || !Number.isFinite(usd) || usd < 1) throw new InvalidArgument("--usd is required: at least 1");
  return api("/paper/buy", { method: "POST", body: { networkId, token, usd }, envelope: true });
}

export async function paperSell(flags: Flags): Promise<unknown> {
  const networkId = parseNetworkId(flags.networkId);
  const token = requireAddress(flags.address, networkId);
  const percent = flags.all ? 100 : Number(flags.percent);
  if (!flags.all && (flags.percent === undefined || !Number.isFinite(percent) || percent <= 0 || percent > 100)) {
    throw new InvalidArgument("--percent 1 to 100, or --all");
  }
  return api("/paper/sell", { method: "POST", body: { networkId, token, percent }, envelope: true });
}

export async function runPaper(sub: string | undefined, flags: Flags): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return flags.help ? 0 : 1;
  }
  switch (sub) {
    case "status":
      checkFlags(flags, [], "paper status");
      print(await api("/paper", { envelope: true }), flags);
      return 0;
    case "buy":
      checkFlags(flags, ["address", "networkId", "usd"], "paper buy");
      print(await paperBuy(flags), flags);
      return 0;
    case "sell":
      checkFlags(flags, ["address", "networkId", "percent", "all"], "paper sell");
      print(await paperSell(flags), flags);
      return 0;
    case "fills": {
      checkFlags(flags, ["limit"], "paper fills");
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 200, fallback: 50 });
      print(await api(`/paper/fills?limit=${limit}`, { envelope: true }), flags);
      return 0;
    }
    case "reset":
      checkFlags(flags, [], "paper reset");
      print(await api("/paper/reset", { method: "POST", envelope: true }), flags);
      return 0;
    default:
      process.stderr.write(`Unknown paper sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
