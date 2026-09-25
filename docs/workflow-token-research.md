# Workflow: researching a token

From a name or an address to something worth telling the user. Four calls, in this order,
because each one changes what the next is worth asking.

## 0. If you were given a name, resolve it first

```bash
moonrush-cli token search --q "<what the user said>" --raw
```

**Do not pick a row silently.** Symbols are not unique and copycats are deliberate: a
popular ticker will return several tokens on the same chain, and one of them is the one
they mean. Prefer a row with `isMoonrushVerified`. When nothing is Verified, show the
candidates with their market cap and liquidity and say which you are going with.

Search is **not** safety-gated, unlike the boards, so a scam that discovery would hide does
appear here. Read `isScam` and `potentialScam` on each row.

## 1. The token itself

```bash
moonrush-cli token info --address <addr> [--networkId <id>] --raw
```

Read, roughly in order of how often each one decides the answer:

| Field | What it tells you |
|---|---|
| `liquidity` | How much can be sold before the price moves. The number that decides whether a position can be exited at all. |
| `volume24` against `liquidity` | Turnover far above the pool size is a wash-trading signature. |
| `holders`, `top10HoldersPercent` | Concentration. A handful of wallets holding most of it is one decision away from the floor. |
| `devHeldPercentage`, `bundlerHeldPercentage`, `sniperHeldPercentage`, `insiderHeldPercentage` | Who was early and how much they kept. |
| `createdAt` | Age. Every risk above reads differently on something four hours old. |
| `isScam`, `potentialScam` | Codex's own flags. |

⚠️ **`null` is not `0`.** On Robinhood Chain the launchpad risk fields come back `null`; on
Soneium and Arc the holder fields do, because the data comes from CoinMarketCap and there
is no holder endpoint. Report those as unknown. Reporting `0` says the top ten wallets hold
nothing, which is the safest-looking answer available and is exactly wrong.

## 2. Is it curated

```bash
moonrush-cli token check --address <addr> --networkId <id> --raw
```

Verified means **a Moonrush admin put it on a list**. Not audited, not endorsed, not safe.
Say it that way. Its absence means even less: most legitimate tokens are not on the list.

## 3. What Moonrush users are doing with it

```bash
moonrush-cli positions stats --tokenAddress <addr> --raw
moonrush-cli positions list --tokenAddress <addr> --sortBy openedAt --limit 20 --raw
```

This is **this product's users**, not the chain. A low count here says the token is not
popular on Moonrush; it says nothing about its distribution. That question was answered in
step 1.

## 4. Write the answer

State the chain. Give liquidity and market cap as figures, not adjectives. Name the risk
fields that are actually high, and name the ones that are unknown as unknown. If the token
is young, say how young.

**Do not end with a buy or sell recommendation.** None of the above is advice, this CLI
cannot place a trade, and a ranking is not a verdict. The useful output is "here is what is
true about it", and then the decision is the user's.
