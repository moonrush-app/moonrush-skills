import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { sanitizeRows, sanitizeTokenRow } from "../lib/sanitize.js";
import { analyze, parseInterval, summarize, toCandles } from "../lib/bars.js";
import { creatorSummary, holderRows } from "../lib/research.js";
import {
  checkFlags,
  parseInteger,
  parseNetworkId,
  parseNetworkIdList,
  requireAddress,
  tokenId,
} from "../lib/validate.js";

const USAGE = `moonrush-cli token <sub> [options]

  info       --address <addr> [--networkId <id>]   Full detail: stats, risk, top holders
  search     --q <phrase> [--networkId <id|csv>]   Find a token by name or symbol
  verified   [--networkId <id|csv>]                The curated Verified roster (no token needed)
  check      --address <addr> [--networkId <id>]   Is one address Verified (no token needed)
  chart      --address <addr> [--interval 1h] [--bars 100] [--analyze]
                                                 Price candles and a summary; --analyze adds
                                                 swing levels, trend, volume, last-candle shape
  risk       --address <addr> [--refresh]          The risk report: warnings, authorities, holder concentration
  holders    --address <addr> [--cursor <c>]       Every holder, largest first, 50 a page, with share of supply
  dev        --address <addr> [--limit 25]         Who created the token, and everything they launched before

--networkId takes an id or a name: solana (default), robinhood, base, bnb, soneium, arc.
--interval: 15s 30s 1m 5m 15m 30m 1h 4h 12h 1d 1w. --bars: 1 to 1500.`;

export async function runToken(
  sub: string | undefined,
  flags: Record<string, string | true>,
): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    // `--help` was answered, so it succeeded. A bare command with no sub-command did not:
    // nothing was asked and nothing was returned, and a script must be able to tell those
    // apart by exit code alone.
    return flags.help ? 0 : 1;
  }

  // Per sub-command, not per command: `token info --q pengu` is just as wrong as
  // `token info --chain 8453`, and a command-wide list would wave the first one through.
  const ALLOWED: Record<string, readonly string[]> = {
    info: ["address", "networkId"],
    search: ["q", "networkId"],
    verified: ["networkId"],
    check: ["address", "networkId"],
    chart: ["address", "networkId", "interval", "bars", "analyze"],
    risk: ["address", "networkId", "refresh"],
    holders: ["address", "networkId", "cursor"],
    dev: ["address", "networkId", "limit"],
  };
  if (ALLOWED[sub]) checkFlags(flags, ALLOWED[sub]!, `token ${sub}`);

  switch (sub) {
    case "chart": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      const { resolution, seconds } = parseInterval(flags.interval);
      const bars = parseInteger(flags.bars, "bars", { min: 1, max: 1500, fallback: 100 });
      const to = Math.floor(Date.now() / 1000);
      const raw = await api<Parameters<typeof toCandles>[0]>("/proxy/getBars", {
        method: "POST",
        body: {
          symbol: tokenId(address, networkId),
          resolution,
          // A window a little wider than the bars asked for, and `countBack` to cap it:
          // a quiet token has gaps, and a window of exactly N intervals returns fewer.
          from: to - seconds * bars * 2,
          to,
          countBack: bars,
          removeLeadingNullValues: true,
        },
      });
      const candles = toCandles(raw).slice(-bars);
      print(
        {
          interval: String(flags.interval ?? "1h"),
          summary: summarize(candles),
          ...(flags.analyze ? { analysis: analyze(candles) } : {}),
          candles,
        },
        flags,
      );
      return 0;
    }

    case "holders": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      const id = tokenId(address, networkId);
      const [page, details] = await Promise.all([
        api<{ count: number | null; cursor: string | null; top10HoldersPercent: number | null; items: { address: string; shiftedBalance?: number; balanceUsd?: string | null; firstHeldTimestamp?: number | null }[] }>(
          "/proxy/holders",
          { method: "POST", body: { tokenId: id, ...(typeof flags.cursor === "string" ? { cursor: flags.cursor } : {}) } },
        ),
        // For the supply, so each row can say what share it is. Best effort.
        api<{ token?: { info?: { totalSupply?: string | number } } }>("/proxy/tokenDetails", {
          method: "POST",
          body: { tokenId: id },
        }).catch(() => null),
      ]);
      const supply = Number(details?.token?.info?.totalSupply);
      print(
        {
          holders: page.count,
          top10HoldersPercent: page.top10HoldersPercent,
          nextCursor: page.cursor,
          rows: holderRows(page.items ?? [], Number.isFinite(supply) && supply > 0 ? supply : null),
        },
        flags,
      );
      return 0;
    }

    case "dev": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 25 });
      const details = await api<{ token?: { creatorAddress?: string | null; symbol?: string } }>(
        "/proxy/tokenDetails",
        { method: "POST", body: { tokenId: tokenId(address, networkId) } },
      );
      const creator = details.token?.creatorAddress;
      if (!creator) {
        print({ creator: null, note: "The creator of this token is not reported." }, flags);
        return 0;
      }
      const launched = await api<{ count?: number; results?: Parameters<typeof creatorSummary>[0] }>(
        "/proxy/creatorTokens",
        { method: "POST", body: { creatorAddress: creator, networkId, limit } },
      );
      const rows = launched.results ?? [];
      // Each launch's name and symbol were written by whoever deployed it: cleaned per row.
      print({ creator, summary: creatorSummary(rows), launches: sanitizeRows(rows) }, flags);
      return 0;
    }

    case "risk": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      // `level` is the verdict (safe / caution / danger); each warning carries a `title` and an
      // `explain` written for a trader, which is what to relay. `facts` and `concentration`
      // are the evidence behind them.
      print(
        await api(
          `/token-risk/${networkId}/${encodeURIComponent(address)}${flags.refresh ? "?refresh=1" : ""}`,
        ),
        flags,
      );
      return 0;
    }

    case "info": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      // ONE STRING, NOT TWO FIELDS. The route validates `{ tokenId: string }` and rejects
      // anything else, so a body of `{ address, networkId }` is a 400 for every address
      // ever passed. It was exactly that until this was written.
      //
      // CLEANED BEFORE IT IS PRINTED. Name, symbol and description are written by whoever
      // deployed the token and go straight into the reader's context. See lib/sanitize.
      print(
        sanitizeTokenRow(
          await api("/proxy/tokenDetails", {
            method: "POST",
            body: { tokenId: tokenId(address, networkId) },
          }),
        ),
        flags,
      );
      return 0;
    }

    case "search": {
      const phrase = typeof flags.q === "string" ? flags.q.trim() : "";
      if (!phrase) {
        process.stderr.write("--q is required, and must not be empty\n");
        return 1;
      }
      const list = parseNetworkIdList(flags.networkId);
      // NOT SAFETY-GATED, deliberately, and that is worth knowing before reading the rows.
      // Discovery hides likely scams; a search returns what was asked for even when
      // discovery would have hidden it, so `isScam` and `potentialScam` on each row are
      // the signal rather than the absence of the row.
      print(
        sanitizeRows(
          await api<unknown[]>(
            `/proxy/filterTokensSearch${list ? `?networkId=${list}` : ""}`,
            { method: "POST", body: { phrase } },
          ),
        ),
        flags,
      );
      return 0;
    }

    case "verified": {
      const list = parseNetworkIdList(flags.networkId);
      // PUBLIC. One of the few routes that needs no token, so this works before anybody
      // has configured one, which makes it the right thing to reach for first when
      // checking whether the CLI can talk to the API at all.
      print(
        await api(
          `/verified/addresses${list ? `?networkId=${list}` : ""}`,
          { anonymous: true },
        ),
        flags,
      );
      return 0;
    }

    case "check": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.address, networkId);
      // Identity is (networkId, address): the same 0x can be Verified on Base and not on
      // BNB, so the chain travels with the lookup rather than being assumed.
      print(
        await api(
          `/verified/check/${encodeURIComponent(address)}?networkId=${networkId}`,
          { anonymous: true },
        ),
        flags,
      );
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
