# Workflow: reviewing a portfolio

What someone holds, what it is worth, and how they got there.

## 1. Holdings and value

```bash
moonrush-cli wallet portfolio --sortBy valueUsd --raw
```

For the signed-in user, **pass no addresses**. An account has two, a Solana one and an EVM
one, and asking with one alone returns a total that is confidently wrong rather than
visibly incomplete.

Add `--refresh` only right after a trade filled. Otherwise the 15-second cache is the
reason this is fast.

⚠️ **Soneium and Arc holdings have no USD value.** Codex does not index those chains, so a
token held there comes back with a balance and no price. The portfolio total legitimately
excludes something the user can see they own. Say so; do not call it zero.

## 2. How the value moved

```bash
moonrush-cli wallet chart --address <addr> --timeRange 30d --raw
```

`unified=true` by default, which is the cross-chain series. Turn it off only if the user
asked about one chain: a single-chain line will not match the total from step 1, and that
mismatch looks like a bug.

## 3. Open and closed trades

```bash
moonrush-cli positions me --status OPEN --sortBy totalPnlUsd --raw
moonrush-cli positions me --status CLOSED --sortBy totalPnlUsd --limit 50 --raw
```

Page with `nextCursorKeyset` from the response, not `nextCursor`. Especially here: sorting
by PnL means the rows are not in time order, so the legacy timestamp cursor cannot say
where you stopped.

Open PnL is **unrealised**, a snapshot against a live price. Quote it with the time you
read it, and do not reuse a figure from earlier in the conversation.

## 4. Everything else that moved

```bash
moonrush-cli wallet activity --userId <uuid> --type all --limit 50 --raw
```

Deposits, withdrawals and transfers that positions do not cover. Pages with an integer
`cursor`, which is not the same pagination as `positions`.

One transfer worth recognising: money arriving from `wallets.creatorPayout` (read it from
`moonrush-cli market config`) is a **creator reward**, not a deposit from a stranger.

## 5. Write the answer

Lead with the total and the biggest positions. Separate realised from unrealised. Name any
holding whose value is unknown rather than quietly leaving it out of the total.

**Do not tell them what to sell.** They asked what they have.
