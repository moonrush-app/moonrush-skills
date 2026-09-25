import { api } from "../lib/api.js";
import { print } from "../index.js";
import { sanitizeTokenRow } from "../lib/sanitize.js";

const USAGE = `moonrush-cli token <sub> [options]

  info       --address <addr> [--networkId <id>]   Token detail
  verified   [--networkId <id>]                    The curated Verified roster
  check      --address <addr>                      Is one address Verified

networkId defaults to Solana (1399811149). Others: 4663 Robinhood, 8453 Base,
56 BNB, 1868 Soneium, 5042 Arc.`;

const SOLANA = 1399811149;

export async function runToken(
  sub: string | undefined,
  flags: Record<string, string | true>,
): Promise<number> {
  if (!sub || flags.help) {
    process.stdout.write(USAGE + "\n");
    return sub ? 0 : 1;
  }
  const networkId = Number(flags.networkId ?? SOLANA);
  const address = typeof flags.address === "string" ? flags.address : undefined;

  switch (sub) {
    case "info": {
      if (!address) {
        process.stderr.write("--address is required\n");
        return 1;
      }
      // POST, not GET, and the address goes in the BODY. `/proxy/*` mirrors Codex's own
      // shape rather than inventing a REST one, and it answers in the `{success,
      // responseObject}` envelope the client already unwraps.
      // CLEANED BEFORE IT IS PRINTED. Name, symbol and description are written by whoever
      // deployed the token and go straight into the reader's context. See lib/sanitize.
      print(
        sanitizeTokenRow(
          await api("/proxy/tokenDetails", {
            method: "POST",
            body: { address, networkId },
          }),
        ),
        flags,
      );
      return 0;
    }

    case "verified": {
      // PUBLIC. One of the few routes that needs no token, so this works before anybody
      // has configured one — which makes it the right thing to reach for first when
      // checking whether the CLI can talk to the API at all.
      print(
        await api(`/verified/addresses?networkId=${networkId}`, {
          anonymous: true,
        }),
        flags,
      );
      return 0;
    }

    case "check": {
      if (!address) {
        process.stderr.write("--address is required\n");
        return 1;
      }
      print(
        await api(`/verified/check/${encodeURIComponent(address)}`, {
          anonymous: true,
        }),
        flags,
      );
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
