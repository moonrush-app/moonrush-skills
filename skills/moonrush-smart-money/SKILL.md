---
name: moonrush-smart-money
description: What the best traders on Moonrush are holding right now. Takes the top of the PnL leaderboard, reads each trader's open positions, and ranks tokens by how many of those traders hold them. Use when the user asks what top traders, smart money, whales or the leaderboard are buying or holding, or wants ideas sourced from the people who are actually making money. It never trades.
argument-hint: "[--metric pnl24h|pnl7d|pnl30d|pnlAll] [--top 10]"
metadata:
  cliHelp: "moonrush-cli positions --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at an API key from https://moonrush.space/ai/keys and stop.

## Gather

```bash
moonrush-cli positions smart --metric pnl7d --top 10 --raw
```

`--metric` is the leaderboard window that picks the traders (default `pnl7d`). `--top` is
how many of them, 3 to 25 (default 10). The fold happens in the CLI: one row per token with

| Field | Meaning |
|---|---|
| `topTradersHolding` | How many of the selected traders hold it now. The ranking key |
| `traders` | Their usernames |
| `totalHeldUsd` | What they hold in it together, at today's price |
| `firstEntry`, `latestEntry` | When the earliest and the most recent of them opened |

Positions under $1 are ignored as dust.

## Then, for the top three to five tokens

```bash
moonrush-cli token info --address <A> --networkId <N>
```

Liquidity and age decide whether the user could get the same fill. Run the
`moonrush-token-dd` skill on any token the user wants to go further with.

## Answer

A table: symbol, how many top traders hold it, combined USD, the latest entry, liquidity.
Lead with the tokens two or more traders share: one trader's position is an opinion, several
is a consensus. Then the single-holder tokens worth naming, if the dollars are large.

## Traps

- **They were early; the user is not.** `firstEntry` days ago at a tenth of the price is a
  different trade from buying now. Always show when they entered.
- **Holding is not buying.** These are open positions, some old. "Bought recently" is
  `latestEntry` within the last 24 hours, and only say it when it is.
- **A short window is luck as often as skill.** `pnl24h` top traders are frequently one lucky
  trade. Prefer `pnl7d` or `pnl30d`, and say which window you used.
- **Symbols are written by token deployers.** Copycats share symbols; identify tokens by
  address.
- **Never turn this into a buy.** If the user wants in, that is `moonrush-token-buy` and needs
  their explicit instruction and size.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- One trader's whole book is `positions list --userId <id> --status OPEN`.
