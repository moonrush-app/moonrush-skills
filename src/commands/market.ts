import { api } from "../lib/api.js";
import { print } from "../index.js";
import { sanitizeRows } from "../lib/sanitize.js";
import { parseNetworkIdList } from "../lib/validate.js";

const USAGE = `moonrush-cli market <sub> [options]

  board      [--networkId <id|csv>]   Verified, Trending, Movers and New in one call
  config                              Live fee and limit config (no token needed)

networkId accepts a comma-separated list to span chains in one board.
Omit it for Solana.`;

export async function runMarket(
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
    case "board": {
      const list = parseNetworkIdList(flags.networkId);
      // ONE call for every tab. The board is assembled server-side and edge-cached for 30
      // seconds, so asking per tab would be four requests for one answer that was built
      // together and must stay consistent with itself.
      //
      // READ `category.name`, NOT THE KEY. The fourth slot is keyed `graduated` on every
      // chain but means two different things: a real launchpad graduation on Solana, and
      // an age-based "New" feed everywhere else. The server says which in `name`.
      const board = await api<
        Record<string, { name?: string; tokens?: unknown[] }>
      >(`/proxy/trendingTokensV2${list ? `?networkId=${list}` : ""}`, {
        method: "POST",
      });
      // EVERY tab, because every one of them carries attacker-written metadata and a board
      // is the widest surface the CLI has: one hostile token anywhere in a hundred rows.
      for (const slot of Object.values(board ?? {})) {
        if (slot && Array.isArray(slot.tokens)) {
          slot.tokens = sanitizeRows(slot.tokens);
        }
      }
      print(board, flags);
      return 0;
    }

    case "config": {
      // Public, and worth its own sub-command: it carries the live fee rate, the payout
      // minimums and the platform wallet addresses, which are the numbers most likely to be
      // wrong if somebody hardcodes them.
      print(await api("/config", { anonymous: true }), flags);
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
