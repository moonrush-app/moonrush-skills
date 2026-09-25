#!/usr/bin/env node
import { ApiError } from "./lib/api.js";
import { InvalidArgument } from "./lib/validate.js";
import { Refused } from "./lib/confirm.js";
import { runConfig } from "./commands/config.js";
import { runToken } from "./commands/token.js";
import { runMarket } from "./commands/market.js";
import { runWallet } from "./commands/wallet.js";
import { runPositions } from "./commands/positions.js";
import { runLeaderboard } from "./commands/leaderboard.js";
import { runRewards } from "./commands/rewards.js";

const USAGE = `moonrush-cli <command> [options]

  config                 Show or set the API token
  token <sub>            Token detail, search, and the Verified roster
  market <sub>           Discovery boards and the live fee config
  wallet <sub>           Balances, portfolio, deposits, chart, activity
  positions <sub>        Trades: public, your own, top, per token
  leaderboard <metric>   PnL rankings over 24h / 7d / 30d / all time
  rewards <sub>          Creator earnings, and claiming them

Run a command with --help for its sub-commands.
Every command prints JSON on stdout. Errors go to stderr and exit 1.`;

/** `--flag value` and `--flag=value`, plus bare `--flag` as true. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[a.slice(2)] = next;
      i++;
    } else {
      out[a.slice(2)] = true;
    }
  }
  return out;
}

/** JSON, always. `--raw` puts it on one line for a pipe. */
export function print(value: unknown, flags: Record<string, unknown>): void {
  process.stdout.write(
    (flags.raw ? JSON.stringify(value) : JSON.stringify(value, null, 2)) + "\n",
  );
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  const sub = rest.find((a) => !a.startsWith("--"));
  const flags = parseArgs(rest);

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE + "\n");
    return 0;
  }

  switch (command) {
    case "config":
      return runConfig(flags);
    case "token":
      return runToken(sub, flags);
    case "market":
      return runMarket(sub, flags);
    case "wallet":
      return runWallet(sub, flags);
    case "positions":
      return runPositions(sub, flags);
    case "leaderboard":
      return runLeaderboard(sub, flags);
    case "rewards":
      return runRewards(sub, flags);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    // A BAD ARGUMENT IS NOT A STACK TRACE. These messages already name the argument and
    // list what it accepts, so wrapping them in anything would only bury that.
    if (err instanceof InvalidArgument || err instanceof Refused) {
      process.stderr.write(err.message + "\n");
      process.exit(1);
    }
    if (err instanceof ApiError && err.isExpiredAuth) {
      // Reached only after a refresh was TRIED and could not help: either no refresh token
      // is stored, or Privy ended the session. Those need different things from the reader,
      // so they are not one message.
      process.stderr.write(
        err.code === "PRIVY_SESSION_ENDED"
          ? "401. Privy ended this session.\n" +
              "Sign in again and re-apply: moonrush-cli config\n"
          : "401. No usable credentials.\n" +
              "An access token alone expires in about an hour. Storing a refresh token\n" +
              "lets the CLI renew itself. Run: moonrush-cli config\n",
      );
      process.exit(1);
    }
    process.stderr.write(
      (err instanceof Error ? err.message : String(err)) + "\n",
    );
    process.exit(1);
  });
