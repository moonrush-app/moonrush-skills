# moonrush-cli reference

Every command prints JSON on stdout. Errors go to stderr and exit 1. `--raw` puts the JSON
on one line, which is what you want when piping into `jq`.

## Setup

```bash
moonrush-cli config --check     # exit 0 if anything works, else 1
moonrush-cli config             # what is configured now
```

**API key.** The only credential. No browser, no expiry, same on a laptop and in CI.

```bash
moonrush-cli config --generate-key
# paste the PUBLIC key at https://moonrush.space/ai/keys
moonrush-cli config --apply-key <key id>.<secret>
```

The private key is written to `~/.config/moonrush/signing-key.pem` at mode 600 and is never
transmitted. `--generate-key` refuses to overwrite one: replacing it breaks every API key
registered with it while the console still lists them as live.

When an API key is configured it is used instead of the browser session, and every request
is signed with that key.

### Tiers

| Tier | Reaches | Needs |
|---|---|---|
| `read` | `token`, `market`, `positions list/top/stats`, `leaderboard` boards | the key id |
| `trade` | `wallet`, `positions me`, `rewards`, `leaderboard rank` | the tier enabled, plus a signature |

A 403 naming a scope means the key works and was not granted that tier. Enable it in the
console; do not re-authenticate.

### Errors you will meet

| Code | What it means |
|---|---|
| `SIGNATURE_REQUIRED` | The endpoint is in the `trade` tier and no signing key was found. |
| `CLOCK_SKEW` | This machine's clock is more than 5 seconds off. Not a key problem. |
| `REPLAY` | The same signed request was sent twice. |
| `BAD_SIGNATURE` | The request changed after it was signed. |
| `RATE_LIMIT_EXCEEDED` | Over the key's per-minute budget. `x-ratelimit-reset` says when. |

## Chains

| id | chain |
|---|---|
| `1399811149` | Solana (the default everywhere) |
| `4663` | Robinhood Chain |
| `8453` | Base |
| `56` | BNB |
| `1868` | Soneium |
| `5042` | Arc |

`--networkId` also takes the chain's name: `solana`/`sol`, `robinhood`/`rh`, `base`,
`bnb`/`bsc`, `soneium`, `arc`. It takes a comma-separated list wherever a board or a roster
spans chains.

## token

```bash
moonrush-cli token info --address So11111111111111111111111111111111111111112
moonrush-cli token info --address 0x4200...0006 --networkId 8453
moonrush-cli token search --q pengu
moonrush-cli token search --q astr --networkId 1868,8453
moonrush-cli token verified --networkId 1868
moonrush-cli token check --address 0x2cae...9441 --networkId 1868
```

`verified` and `check` need no token, which makes them the fastest way to tell "not
configured" from "not working".

Price and risk:

```bash
moonrush-cli token chart --address <addr> [--interval 1h] [--bars 100]   # 15s 30s 1m 5m 15m 30m 1h 4h 12h 1d 1w
moonrush-cli token chart --address <addr> --interval 1h --bars 72 --analyze   # + swing levels, trend, volume, last candle
moonrush-cli token risk --address <addr> [--networkId base] [--refresh]
```

Holders and the creator, from on-chain data:

```bash
moonrush-cli token holders --address <addr> [--cursor <nextCursor>]   # 50 a page, largest first
moonrush-cli token dev --address <addr> [--limit 25]                  # the creator's other launches
```

## market

```bash
moonrush-cli market board
moonrush-cli market board --networkId 8453
moonrush-cli market board --networkId 1399811149,8453,56
moonrush-cli market config          # public
```

`board` returns Verified, Trending, Movers and New together. Do not call it once per tab.

## wallet

```bash
moonrush-cli wallet balances                       # the signed-in user, every chain
moonrush-cli wallet balances --refresh             # bypass the 15s cache after a fill
moonrush-cli wallet portfolio --sortBy pnlUsd
moonrush-cli wallet deposits
moonrush-cli wallet chart --address <addr> --timeRange 7d
moonrush-cli wallet activity --userId <uuid> --type trades --limit 50
```

Any wallet, Moonrush user or not:

```bash
moonrush-cli wallet stats --address <addr> [--networkId <id>]     # 1d / 7d / 30d / 1y record, win rate computed
moonrush-cli wallet created --address <addr> --networkId <id>     # tokens it created on that chain
```

Omit `--sol` and `--evm` for yourself. An account has two addresses and the API knows both.

## positions

```bash
moonrush-cli positions me --status OPEN --sortBy totalPnlUsd
moonrush-cli positions list --tokenAddress <addr> --limit 50
moonrush-cli positions top --sortBy totalPnlUsd
moonrush-cli positions stats --tokenAddress <addr>
moonrush-cli positions smart --metric pnl7d --top 10   # what the top traders hold, by how many hold it
```

Page with `nextCursorKeyset` from the response, passed back as `--cursor`. Not
`nextCursor`: that one is a legacy timestamp and paging by it skips rows.

## leaderboard

```bash
moonrush-cli leaderboard pnl24h
moonrush-cli leaderboard pnl7d --page 2 --limit 100
moonrush-cli leaderboard pnlAll --rank
moonrush-cli leaderboard pnl30d --around
```

Pages with `--page`, not a cursor.

## rewards

```bash
moonrush-cli rewards me
moonrush-cli rewards claim          # MOVES MONEY. Asks on a terminal, refuses without one.
```

## trade

```bash
moonrush-cli trade quote --side buy --usd 25 --address <addr> [--networkId base]
moonrush-cli trade quote --side sell --percent 50 --address <addr>
moonrush-cli trade buy --usd 25 --address <addr> [--slippage 3]        # MOVES MONEY
moonrush-cli trade sell --percent 50 --address <addr>                  # MOVES MONEY
moonrush-cli trade sell --amount 1200 --address <addr>
moonrush-cli trade sell --all --address <addr> --networkId robinhood
```

buy and sell quote first, print the amounts, and ask on a terminal. A returned trade was
submitted, not necessarily filled: check `positions me`.

## orders

```bash
moonrush-cli orders list [--status open|closed|all] [--limit 50]
moonrush-cli orders create --kind limit --side buy --price 0.0042 --usd 20 --address <addr>
moonrush-cli orders create --kind tp --change 50 --percent 50 --address <addr>
moonrush-cli orders create --kind sl --change -20 --percent 100 --address <addr> --worse-fill
moonrush-cli orders create --kind trailing-sl --change -10 --trail 15 --percent 100 --address <addr>
moonrush-cli orders cancel --id <uuid>
```

`create` asks on a terminal: once armed, an order trades by itself.

## feed, mooncall, follow

```bash
moonrush-cli feed posts [--following] [--kinds comment,repost,trade] [--networkId solana,base]
moonrush-cli feed user --username <name>
moonrush-cli mooncall read --positionId <uuid>
moonrush-cli mooncall post --positionId <uuid> --text "..." [--parentId <uuid>]   # PUBLISHES
moonrush-cli follow add|remove --username <name>
moonrush-cli follow list [--followers] [--username <name>]
```

People's text (posts, bios, names) is cleaned of hidden characters before it is printed.

## Profiles

`MOONRUSH_CONFIG_DIR=/path` keeps credentials somewhere other than `~/.config/moonrush`,
for a second account or a CI runner.

## Piping

```bash
moonrush-cli market board --raw | jq '.movers.tokens[] | {s:.token.symbol, c:.change1}'
moonrush-cli positions me --raw | jq '.items[] | select(.totalPnlUsd > 0)'
moonrush-cli token verified --networkId 8453 --raw | jq -r '.addresses[]'
```
