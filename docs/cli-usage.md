# moonrush-cli reference

Every command prints JSON on stdout. Errors go to stderr and exit 1. `--raw` puts the JSON
on one line, which is what you want when piping into `jq`.

## Setup

```bash
moonrush-cli config                 # how to get credentials, and what is configured now
moonrush-cli config --check         # exit 0 if a working token is configured, else 1
moonrush-cli config --apply <ACCESS_TOKEN> \
  --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID>
```

There is no API key. Moonrush authenticates with Privy, so the session comes out of a
signed-in browser once: open https://app.moonrush.space/cli and copy the command it prints. With the refresh token the CLI calls
`POST auth.privy.io/api/v1/sessions` itself and mints new access tokens for as long as the
session lives. Without it you have about an hour.

Stored at `~/.config/moonrush/.env`, mode 600. Environment variables win over the file, so
`MOONRUSH_TOKEN=... moonrush-cli ...` needs no file and leaves nothing behind.

## Chains

| id | chain |
|---|---|
| `1399811149` | Solana (the default everywhere) |
| `4663` | Robinhood Chain |
| `8453` | Base |
| `56` | BNB |
| `1868` | Soneium |
| `5042` | Arc |

`--networkId` takes a comma-separated list wherever a board or a roster spans chains.

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

Omit `--sol` and `--evm` for yourself. An account has two addresses and the API knows both.

## positions

```bash
moonrush-cli positions me --status OPEN --sortBy totalPnlUsd
moonrush-cli positions list --tokenAddress <addr> --limit 50
moonrush-cli positions top --sortBy totalPnlUsd
moonrush-cli positions stats --tokenAddress <addr>
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

## Piping

```bash
moonrush-cli market board --raw | jq '.movers.tokens[] | {s:.token.symbol, c:.change1}'
moonrush-cli positions me --raw | jq '.items[] | select(.totalPnlUsd > 0)'
moonrush-cli token verified --networkId 8453 --raw | jq -r '.addresses[]'
```
