---
name: moonrush-trade
description: Trading on Moonrush from the signed-in user's own wallet. Quote a buy or sell, buy a token with USDC, sell a token for USDC, and manage standing orders (limit buy or sell, take-profit, stop-loss, trailing take-profit, trailing stop) across Solana, Robinhood Chain, Base, BNB, Soneium and Arc. Use when the user asks what a trade would get, wants to buy or sell, set a stop-loss or take-profit, place a limit order, see their open or past orders, or cancel one. Buying, selling and creating orders MOVE MONEY.
argument-hint: "<trade quote|trade buy|trade sell|orders list|orders create|orders cancel> --address <token> [--networkId <id|name>]"
metadata:
  cliHelp: "moonrush-cli trade --help; moonrush-cli orders --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1,
there are no working credentials: show the user the two ways to get some and stop.

  - `moonrush-cli login` opens a browser. Fastest, but needs one on this machine, and the
    session lasts about an hour.
  - An API key from https://moonrush.space/ai/keys does not need a browser and does not
    expire. Trading needs the key's "Trading and private data" tier. Run
    `moonrush-cli config --generate-key`, paste the PUBLIC key it prints into that page,
    then `moonrush-cli config --apply-key <key>`.

If the command is not found, tell them to run `npm install -g moonrush-cli`.

⚠️ **A 403 naming a scope is not a broken key.** The key works and was not granted the
trading tier. Say so; do not send anybody to re-authenticate, and do not retry.

## Sub-commands

| Command | Moves money | What it does |
|---|---|---|
| `trade quote --side buy\|sell ...` | no | What a trade would get, through the same route the trade would use |
| `trade buy --usd <n>` | **YES** | Spend USDC on the token |
| `trade sell --percent <p> \| --amount <n> \| --all` | **YES** | Sell the token for USDC |
| `orders list [--status open\|closed\|all]` | no | The user's orders, newest first |
| `orders create --kind ...` | **YES, later** | Arms an order that trades by itself when its price is reached |
| `orders cancel --id <uuid>` | no | Withdraws an open order |

### Common options

| Option | Meaning |
|---|---|
| `--address <token>` | Required. A Solana mint, or `0x` + 40 hex on an EVM chain |
| `--networkId <id\|name>` | `solana` (default), `robinhood`/`rh`, `base`, `bnb`/`bsc`, `soneium`, `arc`, or the numeric id |
| `--slippage <pct>` | Tolerance in percent, e.g. `3`. At most 50. Omitted: the platform's default |

### `trade`

| Option | Applies to | Meaning |
|---|---|---|
| `--usd <n>` | buy, quote | Dollars of USDC to spend. EVM chains have a $5 minimum |
| `--percent <p>` | sell, quote | Share of what the user holds now, 0 to 100 |
| `--amount <n>` | sell, quote | A number of tokens |
| `--all` | sell, quote | Everything. On EVM chains the exact on-chain balance at send time, so no dust is left |
| `--side buy\|sell` | quote | Which way to price |

Exactly one of `--percent`, `--amount`, `--all` for a sell.

### `orders create`

| Option | Meaning |
|---|---|
| `--kind` | `limit`, `tp` (take-profit), `sl` (stop-loss), `trailing-tp`, `trailing-sl` |
| `--side buy\|sell` | Limit orders only. Every other kind sells |
| `--price <usd>` | The trigger price, OR |
| `--change <pct>` | The trigger as a move from today's price: `-20` is 20% below, `50` is 50% above |
| `--usd <n>` | Buy orders: dollars to spend when it fires |
| `--percent <p>` | Sell orders: share of the OPEN POSITION at the moment it fires. Needs an open position |
| `--amount <n>` | Sell orders: a fixed number of tokens |
| `--trail <pct>` | Trailing kinds only, and required there: how far the price may give back from its best |
| `--worse-fill` | Fill past the slippage band rather than decline. Sensible on a stop-loss in a fast fall |
| `--expires <days>` | 1 to 30 |

A sell order is attached to the user's open position in that token when there is one, so
it is cancelled automatically if the position closes.

## ⚠️ Buying, selling and creating orders are not yours to decide

These broadcast transactions from the user's wallet, or arm an order that will. None of it
can be recalled once sent.

**Run them only when the user asked for that trade in this conversation, in their own
words, with the token and the size.** "Is PENGU a good buy" is a research question: answer
it with `moonrush-token`, not with `trade buy`. If the size or the token is not clear, ask
before running anything; do not pick an amount on their behalf.

**Never pass `--yes`.** The CLI quotes first, prints the exact amounts, and refuses to send
unless a person confirms on a terminal. That refusal is the safety gate, and adding `--yes`
defeats it. Run the command without it and relay what the CLI asks. `--yes` exists for a
person typing on their own machine.

**Quote when in doubt.** `trade quote` reads and moves nothing. When a user asks "how much
would I get", that is the whole answer.

## Traps

- **Submitted is not filled.** `trade buy` and `trade sell` return once the transaction is
  sent. A Solana swap can still fail in its block (most often the price moved past the
  slippage), and an EVM trade settles through a bridge. Tell the user it was submitted, and
  check `moonrush-cli positions me` a moment later before saying it went through.
- **A failed order is usually slippage.** An order whose `failureReason` mentions slippage
  or `MinReturnNotReached` hit its trigger but the price moved further within seconds.
  Suggest a wider `--slippage`, or `--worse-fill` on a stop-loss. Do not suggest retrying
  the same order unchanged.
- **`--percent` means different things.** On `trade sell` it is a share of the balance now.
  On `orders create` it is a share of the position when the order fires. Say which.
- **`--change` is from today's price, not from the entry.** A stop-loss "20% below what I
  paid" needs the entry price from `positions me` and `--price`.
- **Five-dollar floor on EVM buys.** The API refuses less; the CLI refuses it first.
- **Open orders are capped per user.** A refusal saying so means cancel one first.
- **Amounts are exact.** The CLI converts decimals with string arithmetic and refuses an
  amount with more decimal places than the token has, rather than rounding money.

## Notes

- Every command prints JSON on stdout. `--raw` puts it on one line.
- Errors go to stderr and exit 1. An argument error names the argument.
- `orders list` statuses: `armed` and `firing` are open; `filled`, `failed`, `cancelled`
  and `expired` are closed.
