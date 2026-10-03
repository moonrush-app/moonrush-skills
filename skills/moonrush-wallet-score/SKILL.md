---
name: moonrush-wallet-score
description: Score any wallet as a trader, Moonrush user or not. Reads the wallet's on-chain trading record over 1 day, 7 days, 30 days and a year (volume, realised profit, wins, losses, distinct tokens) and turns it into a verdict on whether the wallet is skilled, lucky, a bot or a dev. For a Moonrush user it adds their positions and leaderboard standing. Use when the user pastes a wallet address and asks who it is, whether it is a good trader, whether to copy it, or whether a top holder is smart money.
argument-hint: "--address <wallet> [--networkId <id|name>] | --username <name>"
metadata:
  cliHelp: "moonrush-cli wallet --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at `moonrush-cli login` or an API key from
https://moonrush.space/ai/keys and stop.

## Gather

Any wallet:

```bash
moonrush-cli wallet stats --address <W> [--networkId <N>] --raw
```

It prints `summary` with `lastTradeAt`, `labels` and four windows (`day1`, `week1`,
`day30`, `year1`), each with `swaps`, `uniqueTokens`, `wins`, `losses`, `winRatePct`,
`realizedProfitUsd`, `realizedProfitPct`, `volumeUsd`, `averageTradeUsd` and
`averageProfitPerTradeUsd`. Use these numbers; the raw response sits beside them.

Without `--networkId` the record covers every chain. A 404 means the wallet has no record.

A Moonrush user, by username: their wallet address is on `leaderboard` rows
(`address`, `evmAddress`) and on feed items. Then also:

```bash
moonrush-cli positions list --userId <id> --status CLOSED --sortBy totalPnlUsd --limit 50 --raw
moonrush-cli positions list --userId <id> --status OPEN --sortBy currentBalanceUsd --raw
```

and follow the `docs/workflow-trader-profile.md` measures.

## Score (from `day30`, falling back to `year1` when `day30` has under 10 closed)

Start at 50.

| Rule | Points |
|---|---|
| `winRatePct` 60 or more | +15 |
| `winRatePct` under 35 | -15 |
| `realizedProfitUsd` positive | +15 |
| `realizedProfitUsd` negative | -15 |
| `realizedProfitPct` over 50 | +10 |
| Fewer than 10 closed (`wins + losses`) | -10, and say the sample is small |
| `week1` profit positive as well as `day30` | +10 (consistent) |
| No trade in 14 days (`lastTradeAt`) | -10 (inactive) |

Clamp to 0 to 100.

## Classify before scoring

| Looks like | Rule | Then |
|---|---|---|
| Bot | `day1.swaps` over 500, or `averageTradeUsd` under $5 with over 100 swaps a day | Say so; the score does not describe a human's skill |
| Dev or launch wallet | Few `uniqueTokens` with large profit from one token, or `labels` naming it | Say so; profit from your own launch is not trading |
| Lucky | Over 70% of `year1` profit inside `day30` with under 10 closed | Say so next to the score |

## Answer

Score with band (70 and up **skilled**, 45 to 69 **average**, under 45 **losing**), the
classification if any, the four windows as a compact table (closed, win rate, realised
profit, volume), and the last trade time.

## Traps

- **Win rate counts closed positions only.** A wallet that never sells has `winRatePct: null`,
  not zero.
- **Realised is not total.** Open bags can be deep under water; `realizedProfitUsd` does not
  see them.
- **Labels come from the data provider.** Quote them, do not extend them.
- **Copying is the user's decision.** Following on Moonrush is `follow add`, only when they
  ask.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- Wallet records are cached for about two minutes.
