<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

[English](./Readme.md) ·
[简体中文](./Readme.zh-CN.md) ·
[Français](./Readme.fr.md) ·
[한국어](./Readme.ko.md) ·
**日本語**

[![Console](https://img.shields.io/badge/console-moonrush.space%2Fai-7C3AED)](https://moonrush.space/ai)
[![npm](https://img.shields.io/npm/v/moonrush-cli?color=5865F2&label=moonrush-cli)](https://www.npmjs.com/package/moonrush-cli)
[![X](https://img.shields.io/badge/X-@moonrush__space-000000?logo=x&logoColor=white)](https://x.com/moonrush_space)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/vD66uhAG3h)
[![Telegram](https://img.shields.io/badge/Telegram-announcements-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_space_app)
[![Telegram](https://img.shields.io/badge/Telegram-chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_spacechat)

</div>

Moonrush Agent Skills を使うと、AI エージェントに自然な言葉でこう頼めます。Solana、Robinhood Chain、
Base、BNB、Soneium、Arc のリアルタイムな発見ボード、トークンのファンダメンタルズと名前のついたリスク
判定、Verified 一覧、任意のチャートのテクニカルな読み、集中度と新規クジラを含む保有者の全リスト、
作成者が過去に出した全トークンから算出した実績スコア、任意のウォレットを熟練・幸運・ボット・開発者と
評点した結果、そして PnL リーダーボード上位がいま何を持っているか。

さらに、他のオンチェーン・データ系ツールにはない部分があります。Moonrush はそれ自体がソーシャルな
取引所なので、同じエージェントがフィードとトレーダーのタイムライン、ポジションに付いた mooncall、
フォロー関係を読み、クリエイターには自分のコールを見て取引した人たちからいくら得たかを伝えます。

トレードは一級機能で、実際の資金が動きます。見積り、成行の買いと売り、指値注文、利確・損切りとその
トレーリング版、ひとつの流れで両方の出口を置く bracket エントリー、そして残高・期間ごとの資産価値・
入金・アクティビティというウォレット側。お金を使う経路はすべて、まず見積りを出し、数字を見せ、端末の
前にいる本人に確認します。

> 英語版の [Readme.md](./Readme.md) が唯一の基準です。食い違う場合は英語版に従ってください。

## インストール

```bash
npm install -g moonrush-cli
moonrush-cli config
```

エージェントのプラグインとして:

```bash
npx skills add moonrush-app/moonrush-skills
```

Claude Code など `.claude-plugin` を読むホストなら、上のコマンドだけで足ります。

| ホスト | インストール |
|---|---|
| Claude Code、Codex、OpenCode、Cursor | `npx skills add moonrush-app/moonrush-skills` |
| Codex、手動 | [.codex/INSTALL.md](./.codex/INSTALL.md) |
| OpenCode、手動 | [.opencode/INSTALL.md](./.opencode/INSTALL.md) |
| Cursor | パッケージに [.cursor-plugin/plugin.json](./.cursor-plugin/plugin.json) が入っています。Cursor にこのリポジトリか、インストール済みの npm パッケージを指させてください |

## 自然な言葉で尋ねる

このリポジトリの主役はスキルです。入れたあとはエージェントに話しかけるだけで、スキルとコマンドは
エージェントが選びます。

| こう言うと | これを使います |
|---|---|
| 「PENGU は今日どう?」 | `moonrush-token`、続いてチャートとリスク判定 |
| 「このトークンを採点して: `<アドレス>`」 | `moonrush-token-dd`、0 から 100、減点理由つき |
| 「誰が持っていて、どれくらい偏ってる?」 | `moonrush-holder-analysis` |
| 「この開発者は前に何か出してる?」 | `moonrush-dev-score` |
| 「このウォレットは追う価値ある? `<アドレス>`」 | `moonrush-wallet-score` |
| 「いま上手い人たちは何を持ってる?」 | `moonrush-smart-money` |
| 「このチャートを読んで」 | `moonrush-kline-pattern` |
| 「`<トークン>` を 25 ドル買って」 | `moonrush-token-buy`: 特定、簡易デューデリ、数量、見積り、そして確認 |
| 「X を 50 ドル、+40% で利確、-20% で損切り」 | `moonrush-bracket`: 買い、続いて両方の出口 |
| 「損切りのないポジションはどれ?」 | [ポジションのリスク](./docs/workflow-position-risk.md) ワークフロー |
| 「自分のコールでいくら得た? なぜ届かない?」 | `moonrush-rewards` |

ひと言だけでお金が動くことはありません。スキルはまず見積りを出し、数字を見せ、端末で尋ね、
`--yes` を渡さないよう明記されています。

## スキル

| スキル | 対象 |
|---|---|
| `moonrush-token` | トークン詳細、名前での検索、Verified 一覧 |
| `moonrush-market` | Trending / Movers / New ボード、手数料設定のライブ値 |
| `moonrush-wallet` | 残高、ポートフォリオ、入金、期間ごとの価値、アクティビティ |
| `moonrush-positions` | トレード: 自分の、公開の、上位の、そして誰がそのトークンを持つか |
| `moonrush-leaderboard` | 24 時間 / 7 日 / 30 日 / 全期間の損益ランキング |
| `moonrush-rewards` | クリエイター収益と受け取り |
| `moonrush-trade` | 見積り、買い、売り。指値・利確・損切り・トレーリング注文 |
| `moonrush-token-dd` | トークンのデューデリジェンスを 0 から 100 で、減点理由をすべて明記 |
| `moonrush-social` | フィード、トレーダーのタイムライン、ポジションのスレッド、mooncall、フォロー |
| `moonrush-kline-pattern` | チャートのテクニカルな読み: トレンド、スイング水準、出来高、ルール付きの型 |
| `moonrush-smart-money` | リーダーボード上位の現在の保有、保有者数で並べて |
| `moonrush-token-buy` | 「X を買って」から約定まで: トークン特定、簡易デューデリ、数量、見積り、買い |
| `moonrush-holder-analysis` | 保有者の全リスト、集中度、新規クジラ、プールとバーン |
| `moonrush-dev-score` | 作成者の過去の全ローンチから出す 0 から 100 のスコア |
| `moonrush-wallet-score` | ウォレットのオンチェーン実績をスコアに: 熟練、幸運、ボット、開発者 |
| `moonrush-bracket` | ひとつの流れで建玉と両方の出口まで: 買い、続いて利確と損切り |

## ワークフロー

コマンドをつないで一つの答えにする多段のレシピ:

| ワークフロー | 用途 |
|---|---|
| [トークン調査](./docs/workflow-token-research.md) | 名前かアドレスから、言う価値のある結論まで |
| [デイリーブリーフ](./docs/workflow-daily-brief.md) | 自分の持ち高、発動した注文、フォローの動き、動いたもの |
| [トレーダー評価](./docs/workflow-trader-profile.md) | 追随すべきか: 実績、集中度、約定可能性 |
| [ポジションのリスク](./docs/workflow-position-risk.md) | 保護のない保有はどれか、どの損切りを提案するか |
| [市場の機会](./docs/workflow-market-opportunities.md) | 全チェーンから絞った候補リスト |
| [ポートフォリオ review](./docs/workflow-portfolio-review.md) | 保有、損益、そして何がそれを動かしているか |
| [クリエイター収益](./docs/workflow-creator-earnings.md) | 何を得たか、なぜまだ届かないか |

## コマンド

コマンドとオプション自体は翻訳しません。完全な一覧は英語版の
[Readme.md](./Readme.md#commands) にあります。手元で見るには:

```bash
moonrush-cli --help
moonrush-cli <コマンド> --help
```

## 認証

入口は二つあり、それぞれ別の機械のためのものです。

**ブラウザ、手元のノート用。**

```bash
moonrush-cli login
```

クリック一回。セッションは約一時間で、生きている間は自動で更新されます。

**API キー、サーバー・CI・エージェント用。** ブラウザ不要、期限なし。

```bash
moonrush-cli config --generate-key     # 鍵ペアを生成。秘密鍵は mode 600 でこの機械に残ります
# 公開鍵を https://moonrush.space/ai/keys に貼る
moonrush-cli config --apply-key <key id>.<secret>
```

⚠️ **秘密鍵はこの機械から出ず、アップロードされません。** コンソールは公開鍵しか保存しないので、
サーバーが持つものは署名を検証できるだけで、署名を作ることはできません。あのページが秘密鍵を求める
ことは決してありません。

**キーには二段階があります。** `read` は公開の市場データで、キー ID だけで足ります。誰か一人のもの、
つまりウォレット・ポジション・収益とその受け取りには、"Trading and private data" を有効にしたうえで、
各リクエストのパス・クエリ・本文・タイムスタンプに対する署名が必要です。だからキー ID だけが漏れても
公開ボードしか読めず、傍受されたリクエストも再送や改変ができません。

この境界は読み書きの別ではありません。`rewards me` と `wallet portfolio` はどちらも読み取りですが
上位段階に属します。呼び出しを危険にするのは、返ってくるのが誰のデータかだからです。

`token verified`、`token check`、`market config` は資格情報をまったく必要としません。

**環境変数、コンテナや CI 向け。** 設定ファイルなしで同じ資格情報を使い、両方ある場合は環境変数が
優先されます。[.env.example](./.env.example) を `~/.config/moonrush/.env` にコピーするか、
export してください。

| 変数 | 内容 |
|---|---|
| `MOONRUSH_TOKEN` | 短命のアクセストークン。単体で約一時間動きます。 |
| `MOONRUSH_REFRESH_TOKEN` | 長命の資格情報。これがあれば CLI は自分で更新し、Privy セッションが生きている間は動き続けます。**秘密として扱ってください。** |
| `MOONRUSH_PRIVY_APP_ID`、`MOONRUSH_PRIVY_CLIENT_ID` | 公開値。Privy セッション呼び出しのリクエストヘッダから取ります。 |
| `MOONRUSH_API_BASE` | 任意。既定は `https://social.moonrush.space`。 |

## 安全性

トークンの名前・シンボル・説明は、そのトークンを配備した本人が書いたもので、エージェント向けの CLI
ではそれがモデルのコンテキストに直接入ります。クライアントは不可視文字(bidi オーバーライド、
ゼロ幅接合子、Unicode の tag block)を取り除き、隠れたテキストがモデルに言うことと人に見えることを
違えられないようにします。指示文の検出はしません。その手のフィルタは回避されますし、正当なトークンの
文面まで食べてしまいます。

アドレスは決して書き換えません。

`rewards claim`、`trade buy`、`trade sell`、`orders create` はお金を動かし(注文は後で自ら)、
`mooncall post` は利用者の名前で公開します。いずれも正確な金額か文面を先に示し、端末で確認を取り、
端末がなければ実行を拒みます。`--yes` は本人が自分の機械で打つためのもので、スキルはエージェントに
それを渡さないよう明記しています。

フィードやスレッドに人が書いた文(投稿、プロフィール、表示名)も、トークンのメタデータと同じように
整えられます。

## 開発

```bash
npm ci && npm run build && npm test
```

CI は Node 20 と 24 でビルドとテストを走らせ、各スキルの frontmatter がディレクトリ名と一致するか
確認します。

## リンク

- キーを作るコンソール: [moonrush.space/ai](https://moonrush.space/ai)
- リリースと変更点: [releases](https://github.com/moonrush-app/moonrush-skills/releases)
- 不具合や欲しいコマンドがあれば: [issue を開く](https://github.com/moonrush-app/moonrush-skills/issues)
- [X](https://x.com/moonrush_space) · [Discord](https://discord.gg/vD66uhAG3h) · [Telegram](https://t.me/moonrush_space_app)

プルリクエスト歓迎です。新しいスキルには `name` がディレクトリ名と一致する `SKILL.md` が必要で、
CI がそれを確認します。またこのリポジトリは em dash を使わず、これも CI が確認します。

## ライセンス

MIT
