---
name: moonrush-wallet
description: Read a Moonrush wallet. Balances across every chain in one call, holdings with unrealised PnL, active deposit addresses, portfolio value over time, and one person's activity across every chain they trade. Use when the user asks what they hold, what their portfolio is worth, how their wallet has performed, where to deposit, or what a given account has been doing.
argument-hint: "<balances|portfolio|deposits|chart|activity> [--sol <addr>] [--evm <addr>]"
metadata:
  cliHelp: "moonrush-cli wallet --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1,
there are no working credentials: show the user the two ways to get some and stop.

  - `moonrush-cli login` opens a browser. Fastest, but needs one on this machine, and the
    session lasts about an hour.
  - An API key from https://ai.moonrush.space/keys does not need a browser and does not
    expire, which is the only option on a server or in CI. Run
    `moonrush-cli config --generate-key`, paste the PUBLIC key it prints into that page,
    then `moonrush-cli config --apply-key <key>`.

If the command is not found, tell them to run `npm install -g moonrush-cli`.

⚠️ **AN API KEY HAS TIERS, AND A 403 IS NOT A BROKEN KEY.** A key made without "Trading and
private data" reaches public market data and nothing else. A refusal naming a scope means
the key is fine and was not granted that tier: say so, and do not send anybody to
re-authenticate. Turning the tier on is a toggle in the console.

## Sub-commands

| Command | What it answers |
|---|---|
| `wallet balances [--sol] [--evm] [--refresh]` | Every chain's balances in one call |
| `wallet portfolio [--sol] [--evm] [--sortBy <f>] [--refresh]` | Holdings with value and unrealised PnL |
| `wallet deposits` | The addresses to deposit to right now |
| `wallet chart --address <addr> [--timeRange <r>] [--unified]` | Portfolio value over time |
| `wallet activity --userId <uuid> [--type <t>] [--limit <n>] [--cursor <n>]` | One person, every chain |

`--sortBy`: `valueUsd` (default), `pnlUsd`, `pnlPercent`.
`--timeRange`: `24h` (default), `7d`, `30d`, `all`.
`--type`: `all` (default), `trades`, `transfers`, `cash`.

## Omit the addresses

`--sol` and `--evm` exist to ask about someone else's public addresses. For the signed-in
user, **pass neither**: the API reads their wallets off the token, and it knows about both.

That matters because a Moonrush account has **two addresses, not one**. Solana trades and
EVM cycles are stored under different addresses, so asking with one alone comes back
missing the other's rows entirely, and the total it reports will be confidently wrong
rather than visibly incomplete.

## Cached for 15 seconds, and that is usually right

Balances are cached briefly. Pass `--refresh` **right after a trade fills**, when the cache
is the one thing guaranteed to be stale, and leave it off otherwise: the cache is the
reason this is fast, and refreshing every read puts load on an RPC for no new information.

## `chart` needs `unified`, which is the default here

Without it the series covers one chain's wallet, which for anybody who trades on two is a
line that does not match the portfolio total they just read. The CLI sends `unified=true`
unless told otherwise. Do not turn it off unless the user asked about one specific chain.

## Activity by user, not by address

`wallet activity` takes a **userId**, not an address, and that is the reason to prefer it:
it returns one person's activity across every chain they trade. An address-keyed view
returns one address's, which is half the story for the reason above.

Pages with an integer `cursor`, taken from the previous response. Not the same pagination
as `positions`, which uses an opaque keyset string.

## Soneium and Arc balances have no USD value

⚠️ Codex does not index Soneium (1868), so a token held there returns a balance with **no
USD value and no PnL**. That is the chain, not a failure, and it means a portfolio total
can legitimately exclude something the user can see they hold. Say so rather than
reporting the balance as zero or the call as broken.

## Notes

- Every command accepts `--raw` for single-line JSON.
- A malformed `--sol` or `--evm` is refused locally with the reason, because the API
  answers a generic 400 that does not say which of the two was wrong.
- This skill only reads. Nothing here moves money. Withdrawals and transfers are not
  exposed by this CLI at all.
