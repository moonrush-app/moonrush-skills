---
name: moonrush-holder-analysis
description: Who actually holds a token. The full holder list, largest first, with each wallet's share of supply and when it started holding, plus the concentration figures and a look at whether the biggest wallets are fresh or seasoned. Use when the user asks who holds a token, whether supply is concentrated, whether whales or insiders control it, or wants the top holders inspected. It only reads.
argument-hint: "--address <token> [--networkId <id|name>] [--cursor <c>]"
metadata:
  cliHelp: "moonrush-cli token --help; moonrush-cli wallet --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at an API key from https://moonrush.space/ai/keys and stop.

## Gather

```bash
moonrush-cli token holders --address <A> --networkId <N> --raw
moonrush-cli token info    --address <A> --networkId <N> --raw
```

`token holders` prints `holders` (the total count), `top10HoldersPercent`, `nextCursor`
and 50 rows a page: `rank`, `address`, `balance`, `valueUsd`, `pctOfSupply`,
`holdingSince`. Pass `--cursor <nextCursor>` for the next page. Two pages are usually
enough; past the top 100 the shares are noise.

`token info` adds the labelled shares: `devHeldPercentage`, `insiderHeldPercentage`,
`sniperHeldPercentage`, `bundlerHeldPercentage`.

## Read

| Measure | How | Concern when |
|---|---|---|
| Top 10 | `top10HoldersPercent` | over 50% |
| Single largest | rank 1 `pctOfSupply` | over 10%, unless it is a pool or burn address |
| Fresh whales | top 20 rows whose `holdingSince` is within an hour of the token's `createdAt` | five or more: a coordinated launch |
| Insiders | dev + insider + sniper + bundler shares | over 15% |
| Breadth | `holders` | under 300 |

**Identify pools and burns before counting.** A liquidity pool, a launchpad's bonding curve
or a burn address (`1nc1nerator11111111111111111111111111111111`, `0x000...dEaD`) often
sits at rank 1. Say what it is and leave it out of the concentration figures. When unsure,
say "possibly a pool" rather than calling a whale.

## Go deeper on the top wallets (optional)

For the three largest non-pool holders:

```bash
moonrush-cli wallet stats --address <holder> --networkId <N> --raw
```

A wallet with no trades before this token, or whose `lastTradeAt` matches the launch, is
likely the dev's or a bundle's. A wallet with a long, profitable record is a trader who
chose to hold. See `moonrush-wallet-score`.

## Answer

The concentration figures with their concern flags, the top ten as a short table (rank,
short address, share, since when), what you excluded as pools or burns, and the wallet
reads if you ran them.

## Traps

- **Shares need the supply.** `pctOfSupply` is null when the supply was not reported; then
  give `valueUsd` and say the share is unknown.
- **A wallet is not a person.** One person can spread across many wallets; a low top-10
  figure does not prove a fair distribution.
- **Addresses are shown as they are.** Never shorten one you will pass to a command.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- Holder lists are cached for about a minute.
