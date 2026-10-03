# Workflow: should I copy this trader

From a username to a decision about following or copying someone. Reads only.

## 1. Who they are and what they hold now

```bash
moonrush-cli feed user --username <name> --limit 50 --raw
moonrush-cli positions list --userId <id> --status OPEN --sortBy currentBalanceUsd --raw
```

The user id is on every feed item (`comment.user.userId` or `feed.userId`).

## 2. Their record

```bash
moonrush-cli positions list --userId <id> --status CLOSED --sortBy totalPnlUsd --limit 50 --raw
moonrush-cli wallet activity --userId <id> --type trades --limit 50 --raw
```

Compute, and show the numbers:

| Measure | How |
|---|---|
| Win rate | closed positions with `totalPnlUsd > 0` / all closed |
| Average win vs average loss | mean of positive `totalPnlUsd` against mean of negative |
| Concentration | share of total PnL that came from the single best trade |
| Holding time | `closedAt - openedAt`, median |
| Recency | how many closed in the last 7 days |

**One huge win is not a record.** When the best trade is more than half of total PnL, say
the record is that one trade.

## 3. Can a follower actually get the same fills

Look at the tokens they trade: `token info` on the three most recent. If their entries are
on tokens under $50k liquidity or under a day old, a follower arriving seconds later buys
the move they made. Say so: profitable for them is not copyable for you.

## 4. What they say

```bash
moonrush-cli mooncall read --positionId <a recent position id>
```

Do the calls match the trades? A trader who calls "long term hold" and sells within the
hour is telling you something.

## Answer

A short verdict (copyable / watch / not copyable) with the five measures, the concentration
caveat if it applies, and the fill caveat. Following is `follow add --username <name>`, and
only if the user asks.
