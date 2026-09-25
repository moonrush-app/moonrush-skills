---
name: moonrush-rewards
description: Creator rewards on Moonrush. What the signed-in user has earned from other people trading off their mooncalls, holder rows and feed posts; what is paid, pending, held and available; and claiming what is past its hold. Use when the user asks what they have earned as a creator, why a reward has not arrived, when a held reward unlocks, or wants to claim.
argument-hint: "<me|claim> [--yes]"
metadata:
  cliHelp: "moonrush-cli rewards --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1, run
`moonrush-cli config`, show the user its output, and stop.

## Sub-commands

- `rewards me` for what the signed-in user has earned. Read only.
- `rewards claim` to send them what is past its hold. **MOVES MONEY.**

## ⚠️ `claim` moves money and is not yours to decide

`claim` broadcasts a transfer that cannot be recalled.

**Never run it unless the user asked for it in this conversation, in their own words.** A
user asking "what have I earned" has asked for `rewards me` and nothing else. Reading a
balance is not a request to move it.

**Never pass `--yes`.** It exists so a person can skip the terminal prompt. The CLI refuses
to claim without a terminal precisely so that an agent cannot claim by itself, and adding
`--yes` is defeating a safety gate rather than using a flag. If the user has asked to
claim, run the command without it and relay what the CLI asks.

## What the numbers mean

| Field | Meaning |
|---|---|
| `paidUsd` | Paid and on-chain. What they have actually received, ever. |
| `pendingUsd` | Earned and not yet paid. Everything still owed, held or not. |
| `availableUsd` | The part of `pendingUsd` past its hold, eligible to be sent. |
| `heldUsd` | The part still inside its hold. |
| `pendingCount` | How many rewards make up `pendingUsd`. |
| `nextReleaseAt` | Epoch ms, or null. When the earliest held reward OPENS. |
| `lastPaidAt` | Epoch ms, or null. When they were last actually paid. |
| `minPayoutUsd` | Below this the balance rolls over instead of being sent. |
| `holdHours` | How long a reward is held after it is earned. |

⚠️ **`paidUsd` is not "claimed".** In the admin console "Claimed" means a payout batch is
holding a reward that has NOT been sent, which is nearly the opposite. This field matches
admin's "Paid".

⚠️ **`nextReleaseAt` is a release time, not a payment time.** A held reward *unlocks* then;
it is sent on whatever run comes next. Say "unlocks", never "you will be paid on".

⚠️ **Amounts are decimal strings and they are small.** Creator revenue is a share of the
platform FEE, not of the trade: a $20 trade earns its creator about $0.24. Render at least
two decimal places. Rounding a pending balance to whole dollars rounds it to nothing.

## Why a reward has not arrived

Work through these before suspecting a bug:

1. **It is still held.** Compare `heldUsd` and `nextReleaseAt`. The hold is set from when
   the reward was EARNED, so changing `holdHours` does not move a reward that already
   exists: its unlock time was frozen at accrual.
2. **It is under the threshold.** Below `minPayoutUsd` the balance rolls over. It is not
   lost and it needs no action.
3. **There is no address on file.** The claim answers `no_address`.

## A refusal is not an error

`claim` answers HTTP 200 with `{ claimed: false, reason }` for `nothing_to_claim`,
`below_threshold` and `no_address`. Every one is a normal state with its own copy in the
product. Report the reason; do not report a failure.

## Safe to run twice, but do not poll

The claim goes through the same guard every payout path uses, which includes "not already
claimed": whichever update lands first takes the rows and the loser finds nothing and
creates nothing. So a re-run after a timeout cannot pay twice.

`claimed: true` covers both `sent` and `sending`, because broadcast is the honest moment to
say "on the way". **A `sending` settles itself in the background about twenty seconds
later and the creator is notified when it lands.** Do not poll for it and do not offer a
retry.

## Notes

- Both sub-commands accept `--raw` for single-line JSON.
- `claim` reads the balance first so the confirmation can name the amount. A confirmation
  that cannot state the number is not a confirmation.
