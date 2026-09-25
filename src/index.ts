#!/usr/bin/env node
import { ApiError } from "./lib/api.js";
import { parseArgs, print } from "./lib/args.js";
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
Every command prints JSON on stdout and takes --raw for one line. Errors go to
stderr and exit 1.

No token yet? These three work without one, so you can check the CLI reaches the
API before setting anything up:
  moonrush-cli market config
  moonrush-cli token verified
  moonrush-cli token check --address <addr>`;

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  const { flags, positionals } = parseArgs(rest, command);
  const sub = positionals[0];

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

/**
 * Wait for stdout to reach the OS before ending the process.
 *
 * ⚠️ `process.exit()` DISCARDS BUFFERED STDOUT WHEN STDOUT IS A PIPE. Writes to a file or a
 * terminal are synchronous and survive it; writes to a pipe are not. So
 * `market board --raw > file.json` produced 571KB of valid JSON and
 * `market board --raw | jq` produced exactly 65536 bytes of truncated JSON, which is the
 * pipe buffer and nothing more. Same command, same data, and the broken one is the form
 * the README recommends.
 *
 * A zero-length write's callback runs after every write queued before it has been handed
 * over, because writes are ordered. That is the whole fix.
 */
function flushStdout(): Promise<void> {
  return new Promise((resolve) => {
    // EPIPE is normal here: `| head` closes the pipe as soon as it has enough. Resolving
    // rather than throwing keeps that from being reported as a failure of the command.
    process.stdout.once("error", () => resolve());
    process.stdout.write("", () => resolve());
  });
}

async function exit(code: number): Promise<never> {
  await flushStdout();
  process.exit(code);
}

main()
  .then((code) => exit(code))
  .catch((err: unknown) => {
    // A BAD ARGUMENT IS NOT A STACK TRACE. These messages already name the argument and
    // list what it accepts, so wrapping them in anything would only bury that.
    if (err instanceof InvalidArgument || err instanceof Refused) {
      process.stderr.write(err.message + "\n");
      return exit(1);
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
      return exit(1);
    }
    process.stderr.write(
      (err instanceof Error ? err.message : String(err)) + "\n",
    );
    return exit(1);
  });
