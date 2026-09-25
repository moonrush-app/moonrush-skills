import { api } from "../lib/api.js";
import { print } from "../index.js";
import { sanitizeRows, sanitizeTokenRow } from "../lib/sanitize.js";
import {
  parseNetworkId,
  parseNetworkIdList,
  requireAddress,
  tokenId,
} from "../lib/validate.js";

const USAGE = `moonrush-cli token <sub> [options]

  info       --address <addr> [--networkId <id>]   Full detail: stats, risk, top holders
  search     --q <phrase> [--networkId <id|csv>]   Find a token by name or symbol
  verified   [--networkId <id|csv>]                The curated Verified roster
  check      --address <addr> [--networkId <id>]   Is one address Verified

networkId defaults to Solana (1399811149). Others: 4663 Robinhood, 8453 Base,
56 BNB, 1868 Soneium, 5042 Arc.`;

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

  switch (sub) {
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
