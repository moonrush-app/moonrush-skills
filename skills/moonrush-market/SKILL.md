---
name: moonrush-market
description: Read Moonrush's discovery boards — Trending, Movers, New and Verified — for one chain or several at once, plus the live fee and limit config. Covers Solana, Robinhood Chain, Base, BNB, Soneium and Arc. Use when the user asks what is trending or moving on Moonrush, what is new on a chain, what the current platform fee or referral share is, or wants the board for a specific network.
argument-hint: "<board|config> [--networkId <id|csv>]"
metadata:
  cliHelp: "moonrush-cli market --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1, run
`moonrush-cli config`, show the user its output, and stop until they supply a token.

`market config` needs no token. `market board` does.

## Sub-commands

- `market board [--networkId <id|csv>]` — Trending, Movers, New and Verified in ONE call
- `market config` — live fees, limits and platform wallet addresses

## One call, not four

`board` returns every tab together. Do not call it once per tab: the board is assembled
server-side and edge-cached for 30 seconds, so four calls are four times the work for one
answer that was built as a whole and must stay consistent with itself.

`--networkId` takes a comma-separated list (`1399811149,8453`) to rank several chains in one
board. Omit it for Solana alone.

## A thin board is usually the chain, not a bug

Before reporting a board as broken, check which chain it is:

**Soneium (1868)** is not indexed by Codex at all. Its board comes from a CMC snapshot
filtered by its own gates — measured once at 100 rows in, 16 surviving, of which only a
handful had moved enough for Movers. A short Movers list there is the expected output.

**A multi-chain board applies a per-chain quota.** Each non-Solana chain gets a fixed share
of 150 rows and Solana takes the remainder, so a chain contributing few rows to a combined
board may have a full board of its own. Ask for that chain alone before concluding anything.

## Never quote a fee from memory

`market config` carries `platformFeePercent`, `minPlatformFeeUsd`, `referralSharePercent`
and `referredUserDiscountPercent`. These change without a release. The fee is a rate
**floored at a dollar amount**, so quoting the rate alone is wrong on every small trade — a
$10 trade pays the floor, not the percentage.

It also carries `wallets.creatorPayout`, the address creator payouts are sent FROM. Use it
to recognise an incoming transfer as a reward rather than a deposit from a stranger. Read it
from config every time; it changes when the platform rotates its signing key.

## Board data describes markets, not safety

Trending and Movers rank on activity. A token at the top moved, which is not the same as a
token being good, safe or worth buying. Never present board position as a recommendation,
and never answer "should I buy this" with a ranking.
