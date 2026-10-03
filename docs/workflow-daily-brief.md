# Workflow: the daily brief

"What happened while I was away" in one answer: the user's own book first, then what moved
around them. Reads only.

## 1. Their book

```bash
moonrush-cli wallet portfolio --sortBy pnlUsd --raw
moonrush-cli orders list --raw
moonrush-cli orders list --status closed --limit 20 --raw
```

Lead with the total value and the 24h change, then the two biggest movers in each
direction. From the closed orders, report anything that **filled, failed or was cancelled
since the last brief** (compare `updatedAt`): a stop-loss that fired is the most important
line of the day, and a failed one more so. For a failure, relay why in plain words (most
often the price moved past the slippage) rather than the raw `failureReason`.

List open orders that are close to firing: compare each `triggerPrice` with today's price
from `token info`.

## 2. What the people they follow did

```bash
moonrush-cli feed posts --following --limit 30 --raw
```

Group by token, not by person: "three people you follow bought X" is the useful sentence.
Attribute every call to its author. A follow's mooncall is an opinion, not a signal.

## 3. What is moving on their chains

```bash
moonrush-cli market board --networkId solana,robinhood,base --raw
```

Three names at most, and only ones that pass a quick look: liquidity above $50k and no
`danger` level from `token risk`. More than three is a list, not a brief.

## Shape of the answer

Five short sections, in this order: portfolio, orders (fired / failed / close), follows,
movers, anything that needs action. End with the one or two things worth doing today, each
phrased as an option ("you could tighten the stop on X"), never as an instruction.
