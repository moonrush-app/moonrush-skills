# Workflow: is my book protected

Find the positions that could hurt the user and offer to guard them with orders. Reads,
then writes ONLY what the user confirms.

## 1. What they hold and what already guards it

```bash
moonrush-cli wallet portfolio --sortBy valueUsd --raw
moonrush-cli orders list --raw
```

For each position worth more than a few percent of the book, note whether a `stop_loss` or
`trailing_stop_loss` order exists on that token.

## 2. Risk on each unguarded position

```bash
moonrush-cli token risk --address <addr> --networkId <chain> --raw
moonrush-cli token chart --address <addr> --networkId <chain> --interval 1h --bars 24 --raw
moonrush-cli token info --address <addr> --networkId <chain> --raw
```

Flag, in this order: a `danger` risk level; liquidity smaller than the position (it cannot
be sold without moving the price); a 24h fall over 30%; top 10 holders above 50%.

## 3. Offer protection, do not apply it

For each flagged position, PROPOSE an order and let the user decide:

```bash
moonrush-cli orders create --kind sl --change -20 --percent 100 --address <addr> --networkId <chain>
moonrush-cli orders create --kind trailing-sl --change -10 --trail 15 --percent 100 --address <addr>
```

Say what each one does in plain words ("sells all of it if the price falls 20% from today"),
note that `--change` is from today's price and not from their entry, and suggest
`--worse-fill` on thin tokens so a stop is not declined in a fast fall.

**Never run `orders create` on your own.** It arms an order that trades without asking
again. Run it only for the positions the user picked, and never with `--yes`: the CLI asks
them on a terminal.

## 4. After

`orders list` to show what is now armed.
