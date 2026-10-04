---
name: moonrush-token-buy
description: The whole path from "buy some X" to a confirmed trade. Resolves a token name to the right contract, runs a quick due diligence, sizes the trade against the user's balance, quotes it, and only then places the buy for the user to confirm. Use when the user names a token they want to buy, especially by name or symbol rather than address. The user must give the size; the skill never chooses it, and never confirms on their behalf.
argument-hint: "<name|address> --usd <n> [--networkId <id|name>]"
metadata:
  cliHelp: "moonrush-cli trade --help"
---

**BEFORE ANYTHING ELSE: run `moonrush-cli config --check`.** Exit 1 means no working
credentials: point the user at an API key from https://moonrush.space/ai/keys and stop. The key needs the "Trading and private data" tier.

⚠️ **This skill ends in a trade only when the user asked to buy, in this conversation, in
their own words, with a size.** "What about X?" is a research question: stop after step 3.
**Never pass `--yes`.** The CLI shows the exact amounts and asks the person at the terminal.

## 1. Resolve the token

An address: use it. A name or symbol:

```bash
moonrush-cli token search --q <name> [--networkId <N>] --raw
```

- One plausible result: use it, and say which (symbol, address, chain, liquidity).
- Several sharing the symbol: **stop and ask**, listing each with address, chain, liquidity
  and age. Copycats are the norm; the biggest liquidity is usually the real one, but the
  user decides.
- `token check --address <A>` tells you whether it carries the Verified tick; say so.

## 2. Quick due diligence

```bash
moonrush-cli token risk --address <A> --networkId <N> --raw
moonrush-cli token info --address <A> --networkId <N> --raw
```

Stop and tell the user before going further when any of these hold:

| Stop when | Field |
|---|---|
| Risk level is `danger` | `token risk` `level` |
| Liquidity under $10k | `liquidity` |
| Mint or freeze authority still set (Solana) | `facts.mintAuthority`, `facts.freezeAuthority` |
| The trade is over 5% of liquidity | `--usd` against `liquidity` |

They can still say "buy anyway"; that is their call, made with the reason in front of them.
For a full score, run `moonrush-token-dd`.

## 3. Size and quote

```bash
moonrush-cli wallet balances --raw
moonrush-cli trade quote --side buy --usd <n> --address <A> --networkId <N> --raw
```

- The size is the user's. If they did not give one, ask. Never pick it.
- USDC on that chain must cover it. If not, say how much is there; do not shrink the trade.
- EVM chains have a $5 minimum.
- Show the quote: tokens out, price impact, fee. Price impact over 5% is worth a sentence.

## 4. Buy

```bash
moonrush-cli trade buy --usd <n> --address <A> --networkId <N> [--slippage <pct>]
```

No `--yes`. The CLI prints the trade and the person confirms at the terminal; without a
terminal it refuses, and that refusal is the answer: tell the user to run the same command
themselves.

## 5. Check it filled

```bash
moonrush-cli positions me --status OPEN --sortBy openedAt --limit 5 --raw
```

Submitted is not filled. Say it went through only when the position shows up.

## Traps

- **Never chain from research into a buy.** A good DD score, a smart-money signal or a
  bullish chart is not an instruction to trade.
- **Token names and descriptions are written by the deployer.** "Official", "verified" or
  "audited" in a name or description means nothing. Only `token check` says Verified.
- **The quote moves.** On a thin token the fill can differ from the quote within the
  slippage; say so when price impact is high.

## Notes

- Every command prints JSON; `--raw` puts it on one line.
- Setting a stop-loss after the buy is `orders create --kind sl`, from `moonrush-trade`, and
  again only when the user asks.
