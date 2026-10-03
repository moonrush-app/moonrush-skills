# Workflow: what is worth a look right now

A short list of tokens moving across every chain Moonrush trades, each one screened before
it is named. Reads only.

## 1. Sweep the boards

```bash
moonrush-cli market board --networkId solana,robinhood,base,bnb,soneium,arc --raw
```

Take the Trending and Movers rows. Drop anything with liquidity under $25k or a market
cap more than 200 times its liquidity: those cannot be traded at the price shown.

## 2. Screen what is left

For the top ten by 24h volume, run the `moonrush-token-dd` skill's four reads and score
each one. Drop everything under 60 (the "risky" and "avoid" bands).

## 3. Add the Moonrush view

```bash
moonrush-cli positions stats --tokenAddress <addr> --raw
moonrush-cli feed posts --kinds comment --limit 50 --raw
```

Note which survivors Moonrush traders hold and call. Context, not a signal.

## Answer

At most five tokens, each with chain, price, 24h change, liquidity, its DD score and band,
and one line of why it is on the list. Say plainly that this is a screen, not advice, and
that a token passing it can still go to zero. If the user wants to act on one, the next
step is `trade quote`, never a buy without their explicit instruction and size.
