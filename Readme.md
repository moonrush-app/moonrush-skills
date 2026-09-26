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

Two ways in, and they are for different machines.

**A browser, for your laptop.**

```bash
moonrush-cli login
```

One click. The session lasts about an hour and renews itself while it lives.

**An API key, for a server, CI, or an agent.** No browser, no expiry.

```bash
moonrush-cli config --generate-key     # keypair, private half stays here at mode 600
# paste the PUBLIC key at https://app.moonrush.space/ai/keys
moonrush-cli config --apply-key <key id>.<secret>
```

⚠️ **The private key never leaves your machine and is never uploaded.** The console stores
only the public half, so what the server holds can verify a signature and cannot make one.
Nothing on that page should ever ask for a private key.

**Keys have two tiers.** `read` is public market data and needs only the key id. Anything
that is one person's, which is your wallet, positions, earnings and claiming them, needs
"Trading and private data" enabled AND a signature over the path, query, body and
timestamp of each request. So a leaked key id alone reads public boards and nothing else,
and a captured request cannot be replayed or edited.

The split is not read versus write: `rewards me` and `wallet portfolio` are reads and both
sit in the higher tier, because what makes a call dangerous is whose data comes back.

`token verified`, `token check` and `market config` need no credentials at all.

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
