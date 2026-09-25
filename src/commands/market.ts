import { api } from "../lib/api.js";
import { print } from "../index.js";

const USAGE = `moonrush-cli market <sub> [options]

  board      [--networkId <id|csv>]   Trending, Movers, New and Verified in one call
  config                              Live fee and limit config (no token needed)

networkId accepts a comma-separated list to span chains in one board.
Omit it for Solana.`;

export async function runMarket(
  sub: string | undefined,
  flags: Record<string, string | true>,
): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return sub ? 0 : 1;
  }

  switch (sub) {
    case "board": {
      const q =
        typeof flags.networkId === "string"
          ? `?networkId=${encodeURIComponent(flags.networkId)}`
          : "";
      // ONE call for every tab. The board is assembled server-side and edge-cached for 30
      // seconds, so asking per tab would be four requests for one answer that was built
      // together and must stay consistent with itself.
      print(
        await api(`/proxy/trendingTokensV2${q}`, { method: "POST" }),
        flags,
      );
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
