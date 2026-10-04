---
name: moonrush-bracket
description: Buy a token and set its exits in one go: the buy, then a take-profit and a stop-loss on the position it opens. Use when the user wants to enter a position AND protect it in the same breath, or asks for a buy "with a stop" / "with TP and SL" / "and set my exits". The user gives the size and both levels; the skill never chooses them. This MOVES MONEY, and the exits it places will spend money later.
argument-hint: "<name|address> --usd <n> --tp <pct|price> --sl <pct|price> [--networkId <id|name>]"
metadata:
  cliHelp: "moonrush-cli trade --help; moonrush-cli orders --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at `moonrush-cli login` or an API key from
https://moonrush.space/ai/keys and stop. The key needs the "Trading and private data" tier.

⚠️ **THREE SEPARATE ACTIONS, NOT ONE TRANSACTION.** The buy settles on chain; the exits are
standing orders created afterwards. Nothing makes them atomic, so the dangerous minute is
between them: the buy has filled and nothing is protecting it yet. Step 4 exists entirely to
make sure that minute ends, and to say so out loud if it does not.

⚠️ **Never pass `--yes`.** The CLI shows the exact amounts and asks the person at the
terminal, for the buy and for each order.

## 1. Get the three numbers from the user

| Needed | What it is |
|---|---|
| size | dollars to spend, `--usd` |
| take-profit | the price to sell into, or the gain that triggers it |
| stop-loss | the price to sell at, or the loss that triggers it |

**All three are the user's.** If any is missing, ask for it and stop. Do not derive a stop
from a round number, a chart level, or the token's volatility: a level the agent chose is a
level the user did not agree to, and it is the one that will fire.

A level can be absolute (`--price 0.0042`) or relative (`--change -20`, `--change 50`).
Relative is read against today's price, NOT against the fill, so say which you are sending.
If the user said "20% stop", they almost certainly mean from their entry: after step 3 you
know the fill, so compute the absolute price from it and send `--price`. Say the number back.

## 2. Resolve the token and check it

Exactly as `moonrush-token-buy` does, and for the same reasons: `token search` for a name,
then `token risk` and `token info`. Stop and tell the user on `danger`, on liquidity under
$10k, on a live mint or freeze authority, or when the size is over 5% of liquidity.

A bracket does NOT make a bad token safe. A stop-loss is a request to sell, and on a token
with no liquidity it is a request nobody fills. Say that plainly when liquidity is thin
rather than letting the stop imply a floor that is not there.

## 3. Buy

```bash
moonrush-cli trade quote --side buy --usd <n> --address <A> --networkId <N> --raw
moonrush-cli trade buy --usd <n> --address <A> --networkId <N>
```

Show the quote first: tokens out, price impact, fee. Then let the CLI ask.

## 4. CONFIRM THE FILL BEFORE PLACING ANYTHING

```bash
moonrush-cli positions me --raw
```

A submitted trade is not a filled one. Placing a `--percent` sell against a position that
does not exist yet creates an order for nothing, and the user is left believing they are
covered.

- Position present, with an amount: go on to step 5, and record the fill price.
- Not there yet: wait a few seconds and read again. Twice.
- Still not there: **stop.** Tell the user the buy is in flight and un-exited, give them the
  two commands from step 5 to run themselves once it lands, and do not loop.

## 5. Place the exits, take-profit first

```bash
moonrush-cli orders create --kind tp --address <A> --networkId <N> --price <tp> --percent 100
moonrush-cli orders create --kind sl --address <A> --networkId <N> --price <sl> --percent 100
```

`--percent`, not `--amount`: the share is resolved when the order fires, so it survives the
position changing size afterwards. 100 on both is the common case and means "the whole
position, whichever of these happens first".

**Take-profit before stop-loss.** If only one of the two can be placed, the position should
be left with the stop missing and the user told, not with the stop placed and the upside
unmanaged: an unprotected downside is the thing they must hear about, and it is easier to
hear when it is the last thing that failed.

If either `orders create` fails: say which one, show the error, and give the user the exact
command to retry. Do not retry silently, and do not place a different order than the one
they agreed to.

## 6. Report what now exists

Three facts, in one short block:

- the fill: tokens held, average price, dollars spent
- the take-profit: trigger, and the gain it represents from the fill
- the stop-loss: trigger, and the loss it represents from the fill

Then `moonrush-cli orders list --raw` is how they check later, and
`orders cancel --id <uuid>` is how they undo one.

## What this skill is not

It is not a strategy. It places what the user asked for, in an order that fails safely, and
tells them what happened. For choosing the levels, the material is in `moonrush-token-dd`
(what the token is) and `moonrush-kline-pattern` (where price has turned before). Both are
read-only, and both are for the user to read before deciding.
