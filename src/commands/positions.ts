import { api } from "../lib/api.js";
import { print } from "../index.js";
import {
  parseChoice,
  parseInteger,
  parseNetworkId,
  requireAddress,
  requireUuid,
} from "../lib/validate.js";

const USAGE = `moonrush-cli positions <sub> [options]

  list     [--userId <uuid>] [--tokenAddress <addr>] [--status <s>]
           [--sortBy <f>] [--limit <n>] [--cursor <c>]     Public trades
  me       [--status <s>] [--sortBy <f>] [--limit <n>] [--cursor <c>]
                                                           Your own trades
  top      [--sortBy <f>] [--limit <n>]                    Best open trades
  stats    --tokenAddress <addr> [--networkId <id>]        Who is holding one token

--status: OPEN, CLOSED
--sortBy on list/me: openedAt (default), currentBalanceUsd, totalPnlUsd
--sortBy on top:     totalPnlUsd (default), currentBalanceUsd`;

const STATUS = ["OPEN", "CLOSED"] as const;
const SORT_BY = ["openedAt", "currentBalanceUsd", "totalPnlUsd"] as const;
const TOP_SORT_BY = ["totalPnlUsd", "currentBalanceUsd"] as const;

/**
 * The filters `list` and `me` share, and the pagination rule that is easy to get wrong.
 *
 * ⚠️ PAGE WITH `nextCursorKeyset`, NOT `nextCursor`. The response carries both, and they
 * are not the same value: `nextCursor` is a plain `openedAt` timestamp kept alive for app
 * builds that predate the keyset, and paging by it silently skips or repeats rows wherever
 * two trades share a timestamp or the sort is by value rather than by time. The keyset
 * carries the sort value alongside the timestamp, which is what makes the next page the
 * actual next page.
 */
function listQuery(flags: Record<string, string | true>): URLSearchParams {
  const q = new URLSearchParams();
  const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 });
  q.set("limit", String(limit));
  q.set("sortBy", parseChoice(flags.sortBy, "sortBy", SORT_BY, "openedAt"));
  if (flags.status !== undefined) {
    q.set("status", parseChoice(flags.status, "status", STATUS, "OPEN"));
  }
  if (typeof flags.cursor === "string") q.set("cursor", flags.cursor);
  return q;
}

export async function runPositions(
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

  switch (sub) {
    case "list": {
      const q = listQuery(flags);
      if (flags.userId !== undefined) q.set("userId", requireUuid(flags.userId, "userId"));
      if (typeof flags.tokenAddress === "string") {
        // Not shape-checked against a chain here: this filter matches the stored address
        // across every chain at once, so demanding one shape would rule out the other.
        q.set("tokenAddress", flags.tokenAddress.trim());
      }
      print(await api(`/positions?${q}`), flags);
      return 0;
    }

    case "me":
      // The user's own id comes off the token, so there is nothing to pass and no way to
      // ask about somebody else by accident.
      print(await api(`/positions/me?${listQuery(flags)}`), flags);
      return 0;

    case "top": {
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 10 });
      const sortBy = parseChoice(flags.sortBy, "sortBy", TOP_SORT_BY, "totalPnlUsd");
      print(await api(`/positions/top?sortBy=${sortBy}&limit=${limit}`), flags);
      return 0;
    }

    case "stats": {
      const networkId = parseNetworkId(flags.networkId);
      const address = requireAddress(flags.tokenAddress, networkId);
      // What the token screen's holder row is built from: how many Moonrush users hold
      // this token and what they are up or down. It is a view of THIS product's users,
      // not of the chain, so it says nothing about holders who never traded here.
      print(
        await api(`/positions/stats?tokenAddress=${encodeURIComponent(address)}`),
        flags,
      );
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
