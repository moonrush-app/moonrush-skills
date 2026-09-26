---
name: moonrush-leaderboard
description: Moonrush PnL rankings over 24 hours, 7 days, 30 days and all time. The top of a board, the signed-in user's own rank on it, or the rows either side of them. Use when the user asks who the best traders on Moonrush are, where they place, or how a leaderboard looks over a given window.
argument-hint: "<pnl24h|pnl7d|pnl30d|pnlAll> [--rank] [--around] [--page <n>] [--limit <n>]"
metadata:
  cliHelp: "moonrush-cli leaderboard --help"
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
