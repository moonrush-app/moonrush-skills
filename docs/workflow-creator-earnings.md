# Workflow: "where is my creator reward"

The most common question with the least obvious answer, because four of the words involved
mean something other than what they look like.

## 1. Read the numbers

```bash
moonrush-cli rewards me --raw
```

## 2. Decide which of the four states it is in

```
pendingUsd = heldUsd + availableUsd
paidUsd    = already on-chain, ever
```

**a. Still held.** `heldUsd > 0`, and `nextReleaseAt` says when the earliest one opens.

⚠️ The hold is fixed at the moment the reward was **earned**, not read from today's
setting. So lowering `holdHours` does not release anything that already exists: each
reward's unlock time was frozen when it accrued. A creator who watched an admin change the
setting and expected their money to move is asking a reasonable question with a
counter-intuitive answer, and this is it.

⚠️ `nextReleaseAt` is a **release** time, not a payment time. The reward *unlocks* then and
is sent on whatever run comes next. Say "unlocks". "You will be paid on" is not true.

**b. Under the threshold.** `availableUsd` is above zero but below `minPayoutUsd`. The
balance **rolls over**. Nothing is lost and there is nothing to do. Say that plainly,
because "below the minimum" sounds like a forfeit.

**c. Ready.** `availableUsd >= minPayoutUsd`. It goes out on the next run, or they can take
it now with `rewards claim`.

**d. Already paid.** Check `lastPaidAt` and look for the transfer with
`moonrush-cli wallet activity`. It arrives from the address in
`moonrush-cli market config` under `wallets.creatorPayout`.

## 3. If they expected more

Creator revenue is a share of the **platform fee**, not of the trade. A $20 trade earns its
creator about **$0.24**. Somebody expecting a percentage of volume will find the number
inexplicably small, and the explanation is that it was never a percentage of volume.

Amounts are decimal **strings**. Render at least two decimal places; rounding a pending
balance to whole dollars rounds it to nothing.

## 4. Never say "claimed" for `paidUsd`

⚠️ In the admin console **"Claimed" means a payout batch is holding a reward that has NOT
been sent**, which is nearly the opposite of what the word suggests. `paidUsd` in this API
matches admin's **"Paid"**: money that is on-chain and arrived. Using "claimed" for it puts
a creator and a support agent on two different sides of the same word.

## 5. Claiming, if and only if they asked

```bash
moonrush-cli rewards claim
```

- Only when the user asked, in their own words, in this conversation. Reading a balance is
  not a request to move it.
- **Never add `--yes`.** The CLI refuses to claim when there is no terminal to confirm on.
  That refusal is the gate that stops an agent claiming by itself, and `--yes` defeats it
  rather than using it.
- A refusal comes back as HTTP 200 with `{ claimed: false, reason }`. `nothing_to_claim`,
  `below_threshold` and `no_address` are normal states, not failures.
- `claimed: true` covers `sent` **and** `sending`. A `sending` settles in the background
  about twenty seconds later and the creator is notified. **Do not poll and do not retry.**
