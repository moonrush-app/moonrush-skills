<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

**English** ·
[简体中文](./docs/Readme.zh-CN.md) ·
[Français](./docs/Readme.fr.md) ·
[한국어](./docs/Readme.ko.md) ·
[日本語](./docs/Readme.ja.md)

[![Console](https://img.shields.io/badge/console-moonrush.space%2Fai-7C3AED)](https://moonrush.space/ai)
[![npm](https://img.shields.io/npm/v/moonrush-cli?color=5865F2&label=moonrush-cli)](https://www.npmjs.com/package/moonrush-cli)
[![X](https://img.shields.io/badge/X-@moonrush__space-000000?logo=x&logoColor=white)](https://x.com/moonrush_space)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/vD66uhAG3h)
[![Telegram](https://img.shields.io/badge/Telegram-announcements-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_space_app)
[![Telegram](https://img.shields.io/badge/Telegram-chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_spacechat)

</div>

With Moonrush Agent Skills you can ask an AI agent, in plain language, for live discovery
boards across Solana, Robinhood Chain, Base, BNB, Soneium and Arc, token fundamentals and a
named risk verdict, the Verified roster, a technical read of any chart, the full holder list
with concentration and fresh whales, a creator's history scored from everything they launched
before, any wallet scored as skilled, lucky, bot or dev, and what the top of the PnL
leaderboard is holding right now.

It also carries the part no other chain-data toolkit has: Moonrush is a social exchange, so
the same agent reads the feed and a trader's timeline, the mooncalls under a position and who
follows whom, and tells a creator what they earned from other people trading off their calls.

Trading is first class, and it moves real money: quotes, market buys and sells, limit orders,
take-profit, stop-loss and trailing variants, bracket entries that place both exits in one
flow, and the wallet side with balances, portfolio value over time, deposits, activity, and
cashing out to another address. Every path that spends money quotes first, shows the numbers,
and asks the person at the terminal.

## Install

```bash
npm install -g moonrush-cli
moonrush-cli config
```

As an agent plugin:

```bash
npx skills add moonrush-app/moonrush-skills
```

Claude Code and anything else that reads a `.claude-plugin`: the command above is enough.

| Host | Install |
|---|---|
| Claude Code, Codex, OpenCode, Cursor | `npx skills add moonrush-app/moonrush-skills` |
| Codex, by hand | [.codex/INSTALL.md](./.codex/INSTALL.md) |
| OpenCode, by hand | [.opencode/INSTALL.md](./.opencode/INSTALL.md) |
| Cursor | the package ships [.cursor-plugin/plugin.json](./.cursor-plugin/plugin.json); point Cursor at this repo or the installed npm package |

## Ask in plain language

The skills are the point of this repo. Once they are installed you talk to the agent, and it
picks the skill and the commands:

| What you say | What it reaches for |
|---|---|
| "What is PENGU doing today?" | `moonrush-token`, then the chart and the risk verdict |
| "Score this token: `<address>`" | `moonrush-token-dd`, 0 to 100 with every deduction named |
| "Who holds it, and how concentrated is it?" | `moonrush-holder-analysis` |
| "Has this dev launched anything before?" | `moonrush-dev-score` |
| "Is this wallet worth copying? `<address>`" | `moonrush-wallet-score` |
| "What are the best traders holding right now?" | `moonrush-smart-money` |
| "Read this chart for me" | `moonrush-kline-pattern` |
| "Buy $25 of `<token>`" | `moonrush-token-buy`: resolve, quick DD, size, quote, then it asks you |
| "Buy $50 of X, take profit at +40%, stop at -20%" | `moonrush-bracket`: the buy, then both exits |
| "Which of my positions have no stop-loss?" | the [position risk](./docs/workflow-position-risk.md) workflow |
| "What did my calls earn, and why has it not arrived?" | `moonrush-rewards` |

Nothing that spends money happens on a sentence alone. The skills quote first, show the
numbers, and ask you at the terminal, and they are told never to pass `--yes`.

## Skills

| Skill | Covers |
|---|---|
| `moonrush-token` | Token detail, search by name, the Verified roster |
| `moonrush-market` | Trending / Movers / New boards, live fee config |
| `moonrush-wallet` | Balances, portfolio, deposits, value over time, activity |
| `moonrush-positions` | Trades: own, public, top, and who holds a token |
| `moonrush-leaderboard` | PnL rankings over 24h / 7d / 30d / all time |
| `moonrush-rewards` | Creator earnings, and claiming them |
| `moonrush-trade` | Quote, buy, sell; limit, take-profit, stop-loss and trailing orders |
| `moonrush-token-dd` | A 0 to 100 due-diligence score for a token, every deduction named |
| `moonrush-social` | The feed, a trader's timeline, a position's thread, mooncalls, follows |
| `moonrush-kline-pattern` | A technical read of a chart: trend, swing levels, volume, named patterns with their rules |
| `moonrush-smart-money` | What the leaderboard's top traders hold now, ranked by how many of them hold it |
| `moonrush-token-buy` | From "buy some X" to a confirmed trade: resolve, quick DD, size, quote, buy |
| `moonrush-holder-analysis` | The full holder list, concentration, fresh whales, pools and burns |
| `moonrush-dev-score` | A 0 to 100 score of a token's creator from everything they launched before |
| `moonrush-wallet-score` | Any wallet's on-chain trading record as a score: skilled, lucky, bot or dev |
| `moonrush-bracket` | Buy and set both exits in one flow: the buy, then take-profit and stop-loss |
| `moonrush-send` | Money OUT: cash out USDC on Solana or bridged, and send an EVM asset |

## Workflows

Multi-step recipes that chain the commands into an answer:

| Workflow | For |
|---|---|
| [Token research](./docs/workflow-token-research.md) | From a name or address to what is worth saying about it |
| [Daily brief](./docs/workflow-daily-brief.md) | The user's book, fired orders, what follows did, what moved |
| [Trader profile](./docs/workflow-trader-profile.md) | Should I copy this trader: record, concentration, fillability |
| [Position risk](./docs/workflow-position-risk.md) | Which holdings are unguarded, and proposing stop-losses |
| [Market opportunities](./docs/workflow-market-opportunities.md) | A screened shortlist across every chain |
| [Portfolio review](./docs/workflow-portfolio-review.md) | Holdings, PnL and what is driving it |
| [Creator earnings](./docs/workflow-creator-earnings.md) | What a creator earned and why it has not arrived |

## Commands

```bash
moonrush-cli token info --address <addr> [--networkId <id>]
moonrush-cli token search --q pengu
moonrush-cli token chart --address <addr> --interval 4h --bars 42
moonrush-cli token risk --address <addr> --networkId base
moonrush-cli token verified --networkId 1868
moonrush-cli market board --networkId 1399811149,8453
moonrush-cli market config
moonrush-cli wallet portfolio --sortBy pnlUsd
moonrush-cli wallet balances
moonrush-cli positions me --status OPEN
moonrush-cli positions stats --tokenAddress <addr>
moonrush-cli positions smart --metric pnl7d --top 10
moonrush-cli token holders --address <addr>
moonrush-cli token dev --address <addr>
moonrush-cli wallet stats --address <any wallet>
moonrush-cli leaderboard pnl24h
moonrush-cli rewards me
moonrush-cli rewards claim          # moves money
moonrush-cli trade quote --side buy --usd 25 --address <addr>
moonrush-cli trade buy --usd 25 --address <addr>                  # moves money
moonrush-cli trade sell --percent 50 --address <addr> --networkId base   # moves money
moonrush-cli orders create --kind sl --change -20 --percent 100 --address <addr>
moonrush-cli orders list --status closed
moonrush-cli send usdc --to <address> --amount 50                 # moves money OUT
moonrush-cli send asset --token native --amount max --to <0x...>  # moves money OUT
moonrush-cli feed posts --following --kinds comment
moonrush-cli mooncall read --positionId <uuid>
moonrush-cli mooncall post --positionId <uuid> --text "..."       # publishes
moonrush-cli follow add --username miadang
```

Chains, by id or name: `1399811149` / `solana` (default), `4663` / `robinhood`,
`8453` / `base`, `56` / `bnb`, `1868` / `soneium`, `5042` / `arc`.

Every command prints JSON on stdout and takes `--raw` for one line. Full reference:
[docs/cli-usage.md](./docs/cli-usage.md).

## Auth

**One way in: an API key.** It works the same on a laptop, a server, in CI and inside an
agent, and it does not expire.

The browser sign-in this replaced kept its session on disk, which meant a long-lived
refresh token to a whole account in a file. A key is scoped to `read` or `read` + `trade`,
revocable from the console, and signed by a private half that is generated locally and never
uploaded.

```bash
moonrush-cli config --generate-key     # keypair, private half stays here at mode 600
# paste the PUBLIC key at https://moonrush.space/ai/keys
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

**Environment variables, for a container or a CI job.** The same credentials without a config
file, and they win over the file when both are present. Copy
[.env.example](./.env.example) to `~/.config/moonrush/.env`, or export them:

| Variable | What it is |
|---|---|
| `MOONRUSH_API_KEY` | The credential, `<key id>.<secret>` from the console. |

## Safety

Token names, symbols and descriptions are written by whoever deployed the token, and in a
CLI built for agents they land in a model's context. The client strips invisible characters
(bidi overrides, zero-width joiners, the Unicode tag block) so hidden text cannot say one
thing to a model and another to a person. It does not try to detect instructions: that
filter gets written around, and eats legitimate token copy on the way.

Addresses are never rewritten.

`rewards claim`, `trade buy`, `trade sell` and `orders create` move money (an order
later, by itself), `send usdc` and `send asset` move it OUT and cannot be recalled, and
`mooncall post` publishes under the user's name. Each one shows the
exact amounts or text first, asks on a terminal, and refuses without one. `--yes` exists for
a person typing on their own machine; the skills tell agents never to pass it.

People's text in feeds and threads (posts, bios, display names) is cleaned the same way as
token metadata.

## Development

```bash
npm ci && npm run build && npm test
```

CI runs build and tests on Node 20 and 24 and checks that every skill's frontmatter
matches its directory.

## What it does not do

Worth knowing before you plan an integration around it. Each of these exists in the API and
has no command here yet.

- **Not every transfer.** `send usdc` and `send asset` cover cashing out USDC and moving an
  EVM asset. `/transfer/sol` and `/transfer/token` also exist on the API, for sending SOL and
  an SPL token to another Solana address, and no command calls them yet.
- **No live streams.** The API has six sockets (gateway, chart, intent, trending, verified,
  discovery). A CLI process does not hold one open, so every skill polls instead. For an
  agent that is usually the right trade: asking again is cheap, and a socket it has to
  babysit is not.
- **No perps.** `/perps` is on the API. No skill covers it.
- **No notifications.** Nothing here reads or sends them.

## Links

- The console, where keys are made: [moonrush.space/ai](https://moonrush.space/ai)
- Releases and what changed: [github.com/moonrush-app/moonrush-skills/releases](https://github.com/moonrush-app/moonrush-skills/releases)
- Something wrong, or a command you want: [open an issue](https://github.com/moonrush-app/moonrush-skills/issues)
- [X](https://x.com/moonrush_space) · [Discord](https://discord.gg/vD66uhAG3h) · [Telegram](https://t.me/moonrush_space_app)

Pull requests are welcome. A new skill needs a `SKILL.md` whose `name` matches its directory,
which CI checks, and the house style has no em dashes in it, which CI also checks.

## License

MIT
