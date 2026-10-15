---
name: moonrush-agent
description: Copy-trading building blocks and the hosted Moonrush trading agent. Rank traders by win rate, profit factor, drawdown and hold time with bot and luck flags; watch traders and read "trader X just bought / sold"; find tokens several traders are buying (weighted consensus); and run an agent, on paper or live, with a budget, a daily loss limit and a kill switch, alerting to Telegram. Use when the user asks who trades well, what a trader just did, what good traders agree on, or wants an agent to follow them.
argument-hint: "<rank|traders|activity|consensus|signals|status|setup|pause|resume|stop|watch|telegram> [options]"
metadata:
  cliHelp: "moonrush-cli agent --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 0, carry on. Exit 1,
there are no working credentials: show the user how to get one and stop.

  An API key from https://moonrush.space/ai/keys. Run
  `moonrush-cli config --generate-key`, paste the PUBLIC key it prints into that page, then
  `moonrush-cli config --apply-key <key>`.

`rank`, `traders`, `activity`, `consensus` and `signals` work on a read key. Everything that
is the user's own (`status`, `setup`, `pause`, `resume`, `stop`, `watch`, `telegram`) needs
the "Trading and private data" tier. A 403 naming a scope means the key works and was not
granted that tier.

## The five modules, and the command for each

| Module | What it is | Command |
|---|---|---|
| 1. Pick traders | Every trader's 30-day closed record, scored and flagged | `agent rank`, `agent traders` |
| 2. Track positions | Every buy and sell of tracked traders, within about two minutes | `agent activity`, `agent watch` |
| 3. Weighted consensus | Tokens several traders are net buyers of, weighted and decayed | `agent consensus`, `agent signals` |
| 4. Risk | Budget, per-trade size, open cap, daily loss limit, token floors, exits | `agent setup` |
| 5. Execution | Paper (real quotes) or live (the user's wallet), from Moonrush's servers | `agent setup`, `agent status` |
| Monitoring | Decisions with reasons, push and Telegram alerts | `agent status`, `agent telegram` |

A user's own agent can use modules 1 to 3 and decide 4 and 5 itself with `trade` and
`orders`. Or the hosted agent does all five.

## 1. Ranking traders

```
moonrush-cli agent rank                              # 30 days, by score
moonrush-cli agent rank --window 7d --sort winRate --exclude bot,lucky
moonrush-cli agent traders --limit 20                # the hosted agent's pool, with weights
```

Each row: `closedTrades`, `winRate`, `profitFactor` (gross profit / gross loss),
`realizedPnlUsd`, `bestTradeShare` (the best trade's share of the profit), `medianHoldMin`,
`tradesPerDay`, `maxDrawdownPct` (deepest fall from a peak, hourly), and `flags`:

- `bot`: holds for a minute or two, dozens of times a day. Not followable: it has sold before
  anyone reads the buy.
- `lucky`: over half the profit is one trade.
- `thin`: under ten closed trades. The other numbers are noise.
- `deep_drawdown`: fell more than half from a peak in the window.
- `bag_holder`: losses still held (open positions down, dead tokens) are over half of what
  they realized. Takes profits fast and sits on the losers.

The score keeps conservative books: every loss counts whether realized or still held (dead
tokens written off at cost), and a gain counts only once realized. `netPnlUsd` is realized
minus `heldLossUsd`. `capitalWinRate` weighs each trade by the money put in, so one large
position that collapsed costs more than many small wins earn; `winRate` is the plain count.

`kind: "onchain"` is a real Solana wallet Moonrush imported as a profile; `kind: "user"` is a
Moonrush user. Both trade real money on chain. Say which when you present someone.

Public positions only. Realized results only: an open position's paper gain is not a record.

## 2. What a trader just did

```
moonrush-cli agent watch add --trader @emmett        # tracked every minute from now on
moonrush-cli agent activity --trader @emmett --hours 6
moonrush-cli agent activity --watchlist              # everyone I watch
moonrush-cli agent activity                          # the hosted agent's pool
```

Each event: `direction` (buy / sell), `tokenSymbol`, `tokenAddress`, `usd`, `conviction` (the
trade against the trader's equity, 0 to 1), `blockTime` (unix seconds), `signature`.

`tracked: false` means nobody tracks that trader: their wallet syncs about hourly, so the
answer carries their recent `positions` instead and a note. Suggest `agent watch add` if the
user wants it live. A watchlist holds 50.

### Any on-chain wallet, in realtime

```
moonrush-cli agent watch add --address <solana or 0x wallet> --label "whale 1"
moonrush-cli agent activity --wallet <address>                 # its buys and sells, any wallet
moonrush-cli agent activity --wallet 0x… --networkId base      # one EVM chain only
moonrush-cli agent watch list                                  # traders and wallets
moonrush-cli agent watch remove --address <address>
```

A watched wallet is pushed to the user (and to their linked Telegram) **within seconds** of
each buy or sell: measured at about 1.3 s on Solana and 0.2 to 2 s on Base. It does not need
to be a Moonrush user. One EVM address covers every EVM chain. Routing hops (USDC -> SOL) and
liquidity adds and removes are not reported; trades under $1 are recorded, not pushed. Up to
50 wallets per user.

`agent activity --wallet` works for ANY wallet, watched or not, from the on-chain index:
`direction`, `tokenAddress`, `usd`, `blockTime`, `txHash`, `networkId`. `realtime: true` means
somebody is watching it live. It has no PnL or win rate: for a scored record, use `agent rank`
(Moonrush profiles) or `wallet stats --address`.

It also answers `holding`: `medianHoldMin` (the median minutes from a buy to the next sell of
the same token, over every swap read), `rounds` (how many buy-to-sell rounds that is) and
`scalper`, true when there are at least 3 rounds and the median is under `--min-hold`
(default 10, the hosted agent's `walletMinHoldMin`). A scalper is out a minute or two after it
buys: a copy lands seconds later and leaves seconds later, paying fees twice for little. Check
it before you copy a wallet.

## 3. Consensus

```
moonrush-cli agent consensus                          # the pool, last 6 hours, 2+ traders
moonrush-cli agent consensus --window 2 --min-traders 3
moonrush-cli agent consensus --watchlist              # only traders I chose, equal weight
moonrush-cli agent signals --kind buy                 # what the hosted agent acted on
```

Per trader on a token, once: `weight × (0.5 + 0.5 × conviction) × 0.5^(age / half-life)`.
Net sellers do not count. `score` is the share of the pool's trust that agrees; `traders` names
them. No single pool trader holds more than 15% of the weight.

**A consensus is not advice.** It says several followed traders bought something. Present it
as that, with the numbers and the names, and run `moonrush-token-dd` before anyone buys.

## 4 and 5. The hosted agent

```
moonrush-cli agent setup                              # PAPER, defaults
moonrush-cli agent setup --budget 200 --per-trade 5 --sl 20 --daily-loss 30
moonrush-cli agent status                             # settings, positions, PnL, decisions
moonrush-cli agent pause | resume | stop
moonrush-cli agent telegram link                      # a t.me link; the user taps it
moonrush-cli agent notify --text "Bought BONK for $25"  # a message into that Telegram (60/hour)
moonrush-cli agent setup --networks solana,base       # which chains it may trade
moonrush-cli agent setup --copy-wallets               # also copy the wallets the user watches
moonrush-cli agent setup --copy-wallets --wallet-min-agree 2 --wallet-window 30
```

**Chains.** Solana, Base, BNB, Robinhood and Arc. Every buy is funded from the user's Solana USDC (an EVM buy
bridges it), and every EVM sell delivers USDC back to Solana, so cash is always the Solana
USDC balance. EVM buys and sells settle asynchronously: `decisions` may say "not yet confirmed
on chain" for a minute.

**Copying watched wallets** (`--copy-wallets`). Off by default. When on, the agent also buys
when `--wallet-min-agree` of the wallets the user watches (`agent watch add --address`) buy
the same token inside `--wallet-window` minutes, and sells when one of the wallets it followed
in sells. Same risk limits as everything else. This is where EVM signals come from in
practice: Moonrush users rarely trade on the EVM chains, a watched wallet there does. With
`--wallet-min-agree 1` it copies each watched wallet on its own, so say that plainly before
the user turns it on: whoever they watch, the agent follows.

Every minute: exits first (take profit, stop loss, trailing stop, the followed traders
leaving, max hold), then each new BUY signal is checked against the limits and bought or
refused, with the reason written to `decisions`.

Kill switches, from the user's side: `pause` (no new entries, exits still managed) and `stop`
(sells everything). The daily loss limit pauses it by itself. Moonrush can also switch every
agent off, or live money off; `agent status` → `platform` says which.

### Selling or adding by hand

```
moonrush-cli agent sell --position <id>               # all of it
moonrush-cli agent sell --position <id> --pct 50      # 25, 50 or 75
moonrush-cli agent add --position <id> --pct 25       # buy more with 10/25/50/100% of cash
```

Position ids are in `agent status` → `data.positions`. A partial sell keeps the position open
with a smaller cost. A live agent asks on the terminal first.

### Templates: renting someone's agent

```
moonrush-cli agent templates                          # published agents and their results
moonrush-cli agent template show <slug>               # strategy in words, trades, changes
moonrush-cli agent template follow <slug> --budget 1000 [--per-trade 10 --daily-loss 200]
moonrush-cli agent template leave
```

A rented agent runs the template creator's strategy and copies the creator's watched wallets,
live: when the creator changes something, it changes on the next minute and the user is told.
The user sets only the money: budget, per-trade, max positions, daily loss. `agent setup` with
a strategy flag is refused while following; `template leave` keeps the strategy and the open
positions as the user's own, and sells nothing. Paper only for now.

Results (`stats.return30d` and friends) count every trade at 10% of the account, so a creator
whose budget changed compares fairly. They are paper results: say so, and say how many trades
they rest on (`stats.closedTrades`).

Publishing (`agent publish --slug <s> --name <n>`) needs some days of history and closed
trades (a refusal says how many are missing), and goes live after Moonrush reviews it. Renters never see the creator's wallet
addresses, only how many.

## The rules for an agent driving this

- **Paper first, always.** `agent setup` without `--mode` is paper. Suggest live only after
  the user has read a paper record from `agent status`, and only if they ask.
- **Live trades run from the agent's own wallet,** never the main one. The owner makes and
  funds it on moonrush.space/ai (My agent, "Live wallet"); an API key cannot. Until it exists,
  `setup --mode live` is refused with `AGENT_WALLET_MISSING`: say where to make it, do not retry.
- **Live needs the user's own consent.** `agent setup --mode live` prints the consent text the
  server will record and asks on the terminal. Run it WITHOUT `--yes`. Never answer it for the
  user, never paraphrase the consent away, never add `--yes`.
- **`stop` sells.** For "stop buying", use `pause`.
- **Never choose the limits for the user.** Show the defaults (`agent --help`) and let them
  pick. Percent flags take percentages: `--sl 20` is a 20% stop.
- **`telegram link` returns a link the USER must open.** Show it; do not open it.
- **Building your own runner.** With an agent key (console: "Agent: trades on its own"),
  `trade` and `orders` run without a prompt inside the key's limits; check them with
  `agent key`. Use `agent activity --wallet` (with `holding` to skip scalpers), `agent token`
  for a token's figures and your filters, and `agent notify` to tell the owner what you did.
  Never raise a limit, retry a refused trade in smaller pieces, or move the hosted agent to
  live: those are the owner's. Build and test on `paper` first (`paper status`, `trade buy
  --paper`): the key's own play money, real quotes, nothing moved.

## Reading `agent status`

- `data.stats.realizedPnlUsd` is closed positions; `unrealizedPnlUsd` is open ones at the last
  price the agent saw.
- `data.decisions`: `ok: false` rows carry why it did not trade ("liquidity $12000 under
  $50000", "daily loss limit reached", "no live-trading consent on record"). The first place
  to look when the user asks why it did not buy something.
- `platform.liveTradingEnabled: false` with a live agent: Moonrush has live money off, and the
  agent refuses entries until it is on. Say so; there is nothing the user can do about it.
- `data.paperCashUsd` is the paper book's cash. A live agent spends the wallet's USDC.

## Notes

- Trades Solana, Base, BNB, Robinhood and Arc. Soneium is refused with a reason: exits need a
  price every minute, and nothing prices Soneium tokens yet.
- One agent per user. `setup` on an existing agent changes it. Switching paper and live is
  refused while it holds positions: `stop` first.
- Accepts `--raw` for single-line JSON.
