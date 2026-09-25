import { api } from "../lib/api.js";
import { print } from "../lib/args.js";
import { confirm } from "../lib/confirm.js";
import { checkFlags } from "../lib/validate.js";

const USAGE = `moonrush-cli rewards <sub> [options]

  me        What you have earned from other people's trades
  claim     Send yourself what is past its hold. MOVES MONEY.

claim asks for confirmation on a terminal and refuses without one.
--yes skips the question and is for a person to type, never an agent.`;

interface Earnings {
  paidUsd?: string;
  pendingUsd?: string;
  availableUsd?: string;
  heldUsd?: string;
  minPayoutUsd?: number;
}

export async function runRewards(
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

  const ALLOWED: Record<string, readonly string[]> = { me: [], claim: ["yes"] };
  if (ALLOWED[sub]) checkFlags(flags, ALLOWED[sub]!, `rewards ${sub}`);

  switch (sub) {
    case "me": {
      /**
       * ⚠️ `paidUsd` IS NOT "CLAIMED". In the admin console "Claimed" means a payout batch
       * is holding a reward that has NOT been sent, which is nearly the opposite of what
       * the word suggests here. This field matches admin's "Paid": money that is on-chain
       * and arrived.
       *
       * ⚠️ `nextReleaseAt` is a RELEASE time, not a payment time. A held reward OPENS then;
       * it is sent on whatever run comes next. "Unlocks" is the honest word.
       *
       * Amounts are decimal STRINGS and they are small. A $20 trade earns its creator
       * about $0.24, so rounding a pending balance to whole dollars rounds it to nothing.
       */
      print(await api<Earnings>("/creator-rewards/me"), flags);
      return 0;
    }

    case "claim": {
      // READ BEFORE ASKING. A confirmation that cannot name the amount is not a
      // confirmation, it is a formality: nobody can consent to an unknown number.
      const before = await api<Earnings>("/creator-rewards/me");
      const available = before.availableUsd ?? "0";

      if (Number(available) <= 0) {
        // Not an error and not worth a prompt. Nothing is past its hold, which is an
        // ordinary state with its own copy everywhere else in the product.
        print({ claimed: false, reason: "nothing_to_claim", availableUsd: available }, flags);
        return 0;
      }

      await confirm(
        `Send $${available} to your Solana address now?\n` +
          `This broadcasts a transfer and cannot be recalled.`,
        flags,
      );

      /**
       * SAFE TO PRESS TWICE. It goes through the same `claimable()` guard every payout
       * path uses, which includes "not already claimed": whichever update lands first
       * takes the rows and the loser finds nothing and creates nothing. So a second run
       * after a timeout cannot pay twice.
       *
       * ⚠️ A `sending` status settles itself in the background, roughly twenty seconds
       * later. DO NOT POLL IT and do not offer a retry. `claimed: true` covers both `sent`
       * and `sending`, because broadcast is the honest moment to say "on the way".
       *
       * A refusal arrives as `{ claimed: false, reason }` with HTTP 200, not as an error:
       * `nothing_to_claim`, `below_threshold` (the balance rolls over, it is not lost) and
       * `no_address` are normal states, not failures.
       */
      print(await api("/creator-rewards/claim", { method: "POST" }), flags);
      return 0;
    }

    default:
      process.stderr.write(`Unknown sub-command: ${sub}\n\n${USAGE}\n`);
      return 1;
  }
}
