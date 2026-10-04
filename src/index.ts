#!/usr/bin/env node
import { ApiError } from "./lib/api.js";
import { parseArgs, print } from "./lib/args.js";
import { InvalidArgument } from "./lib/validate.js";
import { Refused } from "./lib/confirm.js";
import { runConfig } from "./commands/config.js";
import { runToken } from "./commands/token.js";
import { runMarket } from "./commands/market.js";
import { runSend } from "./commands/send.js";
import { runWallet } from "./commands/wallet.js";
import { runPositions } from "./commands/positions.js";
import { runLeaderboard } from "./commands/leaderboard.js";
import { runRewards } from "./commands/rewards.js";
import { runTrade } from "./commands/trade.js";
import { runOrders } from "./commands/orders.js";
import { runFeed, runFollow, runMooncall } from "./commands/social.js";

const USAGE = `moonrush-cli <command> [options]

  config                 Show credentials, or set them by hand
  token <sub>            Token detail, search, and the Verified roster
  market <sub>           Discovery boards and the live fee config
  wallet <sub>           Balances, portfolio, deposits, chart, activity
  send <sub>             Cash out USDC, or move an EVM asset out. MOVES MONEY.
  positions <sub>        Trades: public, your own, top, per token
  leaderboard <metric>   PnL rankings over 24h / 7d / 30d / all time
  rewards <sub>          Creator earnings, and claiming them
  trade <sub>            Quote, buy and sell. MOVES MONEY.
  orders <sub>           Limit, take-profit, stop-loss and trailing orders
  feed <sub>             Mooncalls, reposts and trades from everyone or who you follow
  mooncall <sub>         Read a position's thread, or post on it (publishes)
  follow <sub>           Follow, unfollow, and list follows

Run a command with --help for its sub-commands.
Every command prints JSON on stdout and takes --raw for one line. Errors go to
stderr and exit 1.

No API key yet? Run: moonrush-cli config

These three work with no token at all, so you can check the CLI reaches the API:
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
    case "send":
      return runSend(sub, flags);
    case "positions":
      return runPositions(sub, flags);
    case "leaderboard":
      return runLeaderboard(sub, flags);
    case "rewards":
      return runRewards(sub, flags);
    case "trade":
      return runTrade(sub, flags);
    case "orders":
      return runOrders(sub, flags);
    case "feed":
      return runFeed(sub, flags);
    case "mooncall":
      return runMooncall(sub, flags);
    case "follow":
      return runFollow(sub, flags);
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
      /**
       * TWO DIFFERENT 401s, AND TELLING THEM APART IS THE WHOLE POINT OF THIS BRANCH.
       *
       * Having no key at all is where every first-run user starts, and sending them to
       * "check the tier of your key" is advice about a key they have not made. The other
       * 401 is a key that exists and was refused: revoked, mistyped, or below the tier the
       * call needs. One message for both was wrong for the person most likely to see it.
       */
      process.stderr.write(
        err.code === "NO_KEY_CONFIGURED"
          ? `${err.message}\n`
          : "401. This key is not usable for that call.\n" +
              "Check its tier at https://moonrush.space/ai/keys, or apply another:\n" +
              "  moonrush-cli config --apply-key <key id>.<secret>\n",
      );
      return exit(1);
    }
    process.stderr.write(
      (err instanceof Error ? err.message : String(err)) + "\n",
    );
    return exit(1);
  });
