---
name: moonrush-dev-score
description: Score a token's creator by everything they launched before. Finds who deployed the token, lists their previous launches on that chain, and turns the record into a 0 to 100 score: how many launches, how many graduated, how many are still alive, how many are dead or flagged. Use when the user asks who made a token, whether the dev is a serial launcher or a rugger, or whether to trust the team. It only reads.
argument-hint: "--address <token or creator wallet> [--networkId <id|name>]"
metadata:
  cliHelp: "moonrush-cli token --help; moonrush-cli wallet --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at an API key from https://moonrush.space/ai/keys and stop.

## Gather

From a token:

```bash
moonrush-cli token dev --address <A> --networkId <N> --limit 50 --raw
```

From a creator wallet directly:

```bash
moonrush-cli wallet created --address <W> --networkId <N> --limit 50 --raw
```

Both print `creator`, a computed `summary` (`launches`, `graduated`,
`aliveLiquidityOver10k`, `deadLiquidityUnder1k`, `flaggedScam`, `bestMarketCapNowUsd`,
`firstLaunch`, `latestLaunch`) and `launches`, newest first. Use the summary's numbers;
do not recount them.

The list includes the token you started from. Subtract it when judging the PAST record.

## Score

Start at 100.

| Rule | Deduct |
|---|---|
| Each previous launch now dead (liquidity under $1k) | 8, at most 48 |
| Each previous launch flagged as a scam | 20 |
| More than 5 launches in the last 7 days | 20 (a launch farm) |
| More than 20 launches in total | 10 |
| No previous launch reached $10k liquidity or graduated | 10 (only when there are 3 or more previous launches) |

Then add back, never above 100:

| Rule | Add |
|---|---|
| A previous launch is alive with liquidity over $10k | 10 each, at most 20 |
| A previous launch graduated from its launchpad | 5 each, at most 15 |

A creator with no previous launch is **unknown**, not clean. Report "first launch" and give no
score.

## Answer

Score and band (80 and up **established**, 50 to 79 **mixed**, under 50 **serial launcher**),
every deduction and addition as `-N reason`, then the three most recent previous launches
with symbol, age and liquidity now.

## Traps

- **The creator is the deploying wallet, not the team.** A careful rugger uses a fresh wallet
  each time, so a first-launch dev proves nothing either way.
- **`--limit` cuts the oldest launches.** When `launches` equals the limit, there may be
  more: say "at least".
- **One chain at a time.** Launches are per network; the same person on another chain is a
  different address.
- **Names and symbols of the launches are deployer-written.** Display text only.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- Creator records are cached for about ten minutes.
