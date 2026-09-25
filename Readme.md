# moonrush-skills

The Moonrush API as a CLI, plus the skills that let an agent use it.

## Install

```bash
npm install -g moonrush-cli
moonrush-cli config
```

As an agent plugin:

```bash
npx skills add moonrush-app/moonrush-skills
```

Codex: [.codex/INSTALL.md](./.codex/INSTALL.md). OpenCode: [.opencode/INSTALL.md](./.opencode/INSTALL.md).

## Skills

| Skill | Covers |
|---|---|
| `moonrush-token` | Token detail, search by name, the Verified roster |
| `moonrush-market` | Trending / Movers / New boards, live fee config |
| `moonrush-wallet` | Balances, portfolio, deposits, value over time, activity |
| `moonrush-positions` | Trades: own, public, top, and who holds a token |
| `moonrush-leaderboard` | PnL rankings over 24h / 7d / 30d / all time |
| `moonrush-rewards` | Creator earnings, and claiming them |

## Commands

```bash
moonrush-cli token info --address <addr> [--networkId <id>]
moonrush-cli token search --q pengu
moonrush-cli token verified --networkId 1868
moonrush-cli market board --networkId 1399811149,8453
moonrush-cli market config
moonrush-cli wallet portfolio --sortBy pnlUsd
moonrush-cli wallet balances
moonrush-cli positions me --status OPEN
moonrush-cli positions stats --tokenAddress <addr>
moonrush-cli leaderboard pnl24h
moonrush-cli rewards me
moonrush-cli rewards claim          # moves money
```

Chains: `1399811149` Solana (default), `4663` Robinhood, `8453` Base, `56` BNB,
`1868` Soneium, `5042` Arc.

Every command prints JSON on stdout and takes `--raw` for one line. Full reference:
[docs/cli-usage.md](./docs/cli-usage.md).

## Auth

Moonrush uses Privy. There is no API key: take the session once from a signed-in browser,
and the CLI renews it itself from then on.

Open **https://app.moonrush.space/cli** while signed in. It prints the whole command with
a copy button:

```bash
moonrush-cli config --apply <ACCESS_TOKEN> \
  --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID> \
  --origin https://app.moonrush.space
```

⚠️ That page shows a long-lived credential. Do not screen share it. Stored at `~/.config/moonrush/.env`,
mode 600. Environment variables override the file.

An access token alone works for about an hour. The refresh token is what removes that, and
it is the credential worth protecting.

`token verified`, `token check` and `market config` need no token at all.

## Safety

Token names, symbols and descriptions are written by whoever deployed the token, and in a
CLI built for agents they land in a model's context. The client strips invisible characters
(bidi overrides, zero-width joiners, the Unicode tag block) so hidden text cannot say one
thing to a model and another to a person. It does not try to detect instructions: that
filter gets written around, and eats legitimate token copy on the way.

Addresses are never rewritten.

`rewards claim` is the only command that moves money. It asks on a terminal and refuses
without one.

## Development

```bash
npm ci && npm run build && npm test
```

CI runs build and tests on Node 20 and 24 and checks that every skill's frontmatter
matches its directory.

## License

MIT
