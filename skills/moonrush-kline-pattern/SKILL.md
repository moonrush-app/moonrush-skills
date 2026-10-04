---
name: moonrush-kline-pattern
description: Read a token's price chart as a trader would. Trend, the swing levels price has turned at (support and resistance), where price sits in its range, whether volume is building or fading, and the shape of the last candles, all from measurements the CLI computes. Use when the user asks what a chart looks like, whether a token is breaking out or dumping, where support or resistance is, or for a technical read on any timeframe. It never trades and never predicts.
argument-hint: "--address <token> [--networkId <id|name>] [--interval 1h] [--bars 72]"
metadata:
  cliHelp: "moonrush-cli token --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at an API key from https://moonrush.space/ai/keys and stop.

## Gather

```bash
moonrush-cli token chart --address <A> --networkId <N> --interval <I> --bars <B> --analyze --raw
```

Pick the timeframe from the question. When the user did not say, read two:

| Question | Interval and bars |
|---|---|
| "right now", "this hour", a scalp | `5m` x 72 (six hours) |
| default, "today", "this week" | `1h` x 72 (three days), then `15m` x 48 for the latest move |
| "the bigger picture", a hold | `4h` x 90 (fifteen days) or `1d` x 60 |

Fewer than 10 candles comes back as `analysis: null`: say the market is too new or too thin
for a read, and stop there.

## Read, from `analysis`

| Field | What to say |
|---|---|
| `trend`, `halfOverHalfPct` | Up, down or sideways, comparing the mean close of the two halves of the window |
| `positionInRangePct` | 0 is the window low, 100 the high. Over 85: at the top of its range. Under 15: at the bottom |
| `belowHighPct`, `aboveLowPct` | How far from the extremes |
| `nearestResistance`, `nearestSupport` | The closest swing high above and swing low below the close. These are the only levels you may name |
| `swingHighs`, `swingLows` | Lower highs and lower lows in order is a downtrend; higher lows in order is an uptrend |
| `recentVolumeVsEarlier` | The last quarter's average volume over the rest. Over 1.5 is building, under 0.6 is fading |
| `streak` | Consecutive candles of one colour, ending now |
| `lastCandle` | Body and wick shares of the last candle's range |

## Patterns you may name, and the rule for each

Name a pattern only when its rule holds on these numbers. Otherwise describe what the numbers
say without a name.

| Pattern | Rule |
|---|---|
| Breakout | `positionInRangePct` over 90, no `nearestResistance`, and `recentVolumeVsEarlier` over 1.5 |
| Breakout without volume | Same, with `recentVolumeVsEarlier` under 1. Say it is unconfirmed |
| Breakdown | `positionInRangePct` under 10, no `nearestSupport`, `trend` down |
| Higher lows | The last three `swingLows` each above the one before |
| Lower highs | The last three `swingHighs` each below the one before |
| Range | `trend` sideways and at least two swing highs and two swing lows |
| Rejection wick | `lastCandle.upperWickPctOfRange` over 60 near resistance, or `lowerWickPctOfRange` over 60 near support |
| Exhaustion | `streak.candles` of 6 or more with `recentVolumeVsEarlier` under 0.8 |
| Dead chart | `averageCandleRangePct` under 0.5 and volume fading |

## Answer

One line of verdict (trend and where price sits), then the levels with their prices and
times, the volume read, and any named pattern with the rule that triggered it. Give prices
with the same significant digits the CLI printed.

## Traps

- **Patterns describe, they do not predict.** Never say a token "will" go anywhere. Say what
  the chart did and which level it is near.
- **A memecoin chart is mostly noise below an hour.** On `1m` and `5m` say so, and prefer
  the 1h read for anything beyond the next few minutes.
- **A new token's chart starts at its launch.** A window wider than the token's life is just
  its whole life; `summary.from` shows where the data begins.
- **The chart says nothing about safety.** A clean breakout on a token with mint authority is
  still a token with mint authority. Point at `moonrush-token-dd` for that.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- Intervals: 15s 30s 1m 5m 15m 30m 1h 4h 12h 1d 1w. Bars: 1 to 1500.
