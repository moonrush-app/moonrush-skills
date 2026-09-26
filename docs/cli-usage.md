# moonrush-cli reference

Every command prints JSON on stdout. Errors go to stderr and exit 1. `--raw` puts the JSON
on one line, which is what you want when piping into `jq`.

## Setup

```bash
moonrush-cli config --check     # exit 0 if anything works, else 1
moonrush-cli config             # what is configured now
```

**Browser sign-in.** Needs a browser on this machine; the session lasts about an hour.

```bash
moonrush-cli login
```

**API key.** No browser, no expiry. The only option on a server or in CI.

```bash
moonrush-cli config --generate-key
# paste the PUBLIC key at https://app.moonrush.space/ai/keys
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
