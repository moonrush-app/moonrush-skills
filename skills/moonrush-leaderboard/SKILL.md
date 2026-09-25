---
name: moonrush-leaderboard
description: Moonrush PnL rankings over 24 hours, 7 days, 30 days and all time. The top of a board, the signed-in user's own rank on it, or the rows either side of them. Use when the user asks who the best traders on Moonrush are, where they place, or how a leaderboard looks over a given window.
argument-hint: "<pnl24h|pnl7d|pnl30d|pnlAll> [--rank] [--around] [--page <n>] [--limit <n>]"
metadata:
  cliHelp: "moonrush-cli leaderboard --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1, run
`moonrush-cli config`, show the user its output, and stop.

## Usage

```
moonrush-cli leaderboard pnl24h                 # top 50
moonrush-cli leaderboard pnl7d --page 2         # next 50
moonrush-cli leaderboard pnl30d --rank          # just my position
moonrush-cli leaderboard pnlAll --around        # the rows either side of me
```

The metric is positional and required. There are four: `pnl24h`, `pnl7d`, `pnl30d`,
`pnlAll`.

## There is no "the leaderboard"

Four windows, four different answers about who is winning, and they disagree. A trader who
tops `pnl24h` may not be in the top hundred of `pnlAll`, and one good day is not a track
record.

So when the user asks who the best traders are without naming a window, **ask which one**
or state plainly which you read. Never present one window's board as "the" ranking.

## Pages, not cursors

This endpoint pages with `--page` and `--limit`, 1-based, limit up to 100. That is
different from `positions` and the discovery boards, which are cursor-paged. Reaching for
`--cursor` here gets it silently ignored, so the second page would be the first page again.

## What the number is

Realised and unrealised PnL over the window, in USD, computed from positions recorded by
this product. It says nothing about a trader's activity anywhere else, and a large figure
is a measure of size as much as of skill.

**Never present a leaderboard position as a recommendation to copy anyone.** This CLI has
no copy-trading, and a ranking is not advice.

## Notes

- Accepts `--raw` for single-line JSON.
- `--rank` and `--around` are about the signed-in user and take no id. There is no way to
  ask them about somebody else.
- `--limit` caps at 100, and the CLI refuses a larger one locally rather than letting the
  API answer a bare 400.
