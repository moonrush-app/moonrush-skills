import { api } from "../lib/api.js";
import { print } from "../index.js";
import {
  InvalidArgument,
  isEvmAddress,
  isSolanaAddress,
  parseChoice,
  parseInteger,
  requireUuid,
} from "../lib/validate.js";

const USAGE = `moonrush-cli wallet <sub> [options]

  balances    [--sol <addr>] [--evm <addr>] [--refresh]   Every chain, one call
  portfolio   [--sol] [--evm] [--sortBy <field>] [--refresh]
                                                          Holdings with PnL
  deposits                                                Active deposit addresses
  chart       --address <addr> [--timeRange <r>] [--unified]
                                                          Portfolio value over time
  activity    --userId <uuid> [--type <t>] [--limit <n>] [--cursor <n>]
                                                          One person, every chain

--sortBy: valueUsd (default), pnlUsd, pnlPercent
--timeRange: 24h (default), 7d, 30d, all
--type: all (default), trades, transfers, cash`;

const SORT_BY = ["valueUsd", "pnlUsd", "pnlPercent"] as const;
const TIME_RANGE = ["24h", "7d", "30d", "all"] as const;
const ACTIVITY_TYPE = ["all", "trades", "transfers", "cash"] as const;

/**
 * The two addresses a Moonrush account actually has.
 *
 * Omitting both is the normal case: the API reads the signed-in user's own wallets off the
 * token. They exist so one account can be asked about another's public addresses, and
 * because a user's Solana trades and their EVM cycles live under DIFFERENT addresses, so
 * asking with one alone comes back missing the other's rows entirely.
 */
function addressPair(flags: Record<string, string | true>): string {
  const q = new URLSearchParams();
  const sol = typeof flags.sol === "string" ? flags.sol.trim() : undefined;
  const evm = typeof flags.evm === "string" ? flags.evm.trim() : undefined;
  if (sol) {
    if (!isSolanaAddress(sol)) {
      throw new InvalidArgument(`--sol is not a Solana address: ${sol}`);
    }
    q.set("sol", sol);
  }
  if (evm) {
    if (!isEvmAddress(evm)) {
      throw new InvalidArgument(`--evm is not an EVM address: ${evm}`);
    }
    q.set("evm", evm);
  }
  // `?refresh=1` bypasses the 15 second balance cache. Worth exposing and not worth
  // defaulting to: right after a trade fills the cache is the wrong answer, and every
  // other time it is the reason this is fast.
  if (flags.refresh) q.set("refresh", "1");
  return q.toString() ? `?${q}` : "";
}

export async function runWallet(
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
    case "balances":
      print(await api(`/wallet/balances${addressPair(flags)}`), flags);
      return 0;

    case "portfolio": {
      const q = addressPair(flags);
      const sortBy = parseChoice(flags.sortBy, "sortBy", SORT_BY, "valueUsd");
      print(
        await api(`/wallet/portfolio${q ? `${q}&` : "?"}sortBy=${sortBy}`),
        flags,
      );
      return 0;
    }

    case "deposits":
      print(await api("/wallet/deposits/active"), flags);
      return 0;

    case "chart": {
      const address = typeof flags.address === "string" ? flags.address.trim() : "";
      if (!isSolanaAddress(address) && !isEvmAddress(address)) {
        throw new InvalidArgument(
          `--address must be a Solana or EVM address, got: ${address || "(nothing)"}`,
        );
      }
      const timeRange = parseChoice(flags.timeRange, "timeRange", TIME_RANGE, "24h");
      // `unified=true` is the cross-chain series. Without it the chart is one chain's
      // wallet, which for anybody who trades on two is a number that does not match the
      // portfolio total they just read.
      const unified = flags.unified === undefined ? "true" : String(flags.unified);
      print(
        await api(
          `/wallet/${encodeURIComponent(address)}/chart?unified=${unified}&timeRange=${timeRange}`,
        ),
        flags,
      );
      return 0;
    }

    case "activity": {
      const userId = requireUuid(flags.userId, "userId");
      const type = parseChoice(flags.type, "type", ACTIVITY_TYPE, "all");
      const limit = parseInteger(flags.limit, "limit", { min: 1, max: 50, fallback: 20 });
      const q = new URLSearchParams({ type, limit: String(limit) });
      if (typeof flags.cursor === "string") q.set("cursor", flags.cursor);
      // BY USER, not by address, and that is the whole reason to prefer this route: one
      // person's activity across every chain they trade, rather than one address's.
      print(await api(`/wallet/user/${userId}/activities?${q}`), flags);
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
