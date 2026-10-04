<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

[English](./Readme.md) ·
**简体中文** ·
[Français](./Readme.fr.md) ·
[한국어](./Readme.ko.md) ·
[日本語](./Readme.ja.md)

[![Console](https://img.shields.io/badge/console-moonrush.space%2Fai-7C3AED)](https://moonrush.space/ai)
[![npm](https://img.shields.io/npm/v/moonrush-cli?color=5865F2&label=moonrush-cli)](https://www.npmjs.com/package/moonrush-cli)
[![X](https://img.shields.io/badge/X-@moonrush__space-000000?logo=x&logoColor=white)](https://x.com/moonrush_space)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/vD66uhAG3h)
[![Telegram](https://img.shields.io/badge/Telegram-announcements-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_space_app)
[![Telegram](https://img.shields.io/badge/Telegram-chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_spacechat)

</div>

有了 Moonrush Agent Skills，你可以用自然语言让 AI 助手查询：Solana、Robinhood Chain、Base、BNB、
Soneium 和 Arc 上的实时发现榜单，代币基本面与明确的风险判定，Verified 认证名单，任意图表的技术解读，
完整持币地址列表及集中度与新进巨鲸，按创建者此前发行过的全部代币给出的信用评分，把任意钱包评为
熟练、运气、机器人或开发者的评分，以及 PnL 排行榜顶部的交易者此刻持有什么。

它还包含其他链上数据工具没有的部分：Moonrush 本身是一个社交交易所，所以同一个助手可以读取动态流和
某个交易者的时间线、某个仓位下的 mooncall 评论以及关注关系，并告诉创作者别人跟着他的喊单交易为他
赚了多少。

交易是一等公民，并且会动用真实资金：报价、市价买卖、限价单、止盈、止损及其追踪变体、一次流程内同时
挂好两个出场单的 bracket 建仓，以及钱包侧的余额、组合价值变化、充值与活动记录。每一条花钱的路径都会
先报价、把数字摆出来，并在终端上向本人确认。

> 英文版 [Readme.md](./Readme.md) 是唯一权威版本。本页若与之不一致，以英文版为准。

## 安装

```bash
npm install -g moonrush-cli
moonrush-cli config
```

作为助手插件：

```bash
npx skills add moonrush-app/moonrush-skills
```

Codex：[.codex/INSTALL.md](./.codex/INSTALL.md)。OpenCode：[.opencode/INSTALL.md](./.opencode/INSTALL.md)。

## 技能

| 技能 | 覆盖范围 |
|---|---|
| `moonrush-token` | 代币详情、按名称搜索、Verified 名单 |
| `moonrush-market` | Trending / Movers / New 榜单，实时费率配置 |
| `moonrush-wallet` | 余额、组合、充值、价值变化、活动记录 |
| `moonrush-positions` | 交易：自己的、公开的、最佳的，以及谁持有某代币 |
| `moonrush-leaderboard` | 24 小时 / 7 天 / 30 天 / 全部时间的盈亏排名 |
| `moonrush-rewards` | 创作者收益及领取 |
| `moonrush-trade` | 报价、买入、卖出；限价、止盈、止损与追踪单 |
| `moonrush-token-dd` | 代币 0 到 100 的尽调评分，每一项扣分都写明原因 |
| `moonrush-social` | 动态流、交易者时间线、仓位评论串、mooncall、关注 |
| `moonrush-kline-pattern` | 图表的技术解读：趋势、摆动位、成交量、带规则的形态 |
| `moonrush-smart-money` | 排行榜顶部交易者当前的持仓，按持有人数排序 |
| `moonrush-token-buy` | 从「买点 X」到成交：解析代币、快速尽调、定量、报价、买入 |
| `moonrush-holder-analysis` | 完整持币列表、集中度、新进巨鲸、池子与销毁 |
| `moonrush-dev-score` | 依据创建者此前的全部发行给出 0 到 100 的评分 |
| `moonrush-wallet-score` | 把任意钱包的链上交易记录评为：熟练、运气、机器人或开发者 |
| `moonrush-bracket` | 一次流程内完成建仓并挂好两个出场单：买入，然后止盈与止损 |

## 工作流

把多条命令串成一个答案的多步方案：

| 工作流 | 用于 |
|---|---|
| [代币研究](./docs/workflow-token-research.md) | 从一个名称或地址，到真正值得说的结论 |
| [每日简报](./docs/workflow-daily-brief.md) | 自己的持仓、已触发的委托、关注的人做了什么、什么在动 |
| [交易者画像](./docs/workflow-trader-profile.md) | 该不该跟这个人：记录、集中度、能否成交 |
| [仓位风险](./docs/workflow-position-risk.md) | 哪些持仓没有保护，并给出止损建议 |
| [市场机会](./docs/workflow-market-opportunities.md) | 跨全部链筛出的候选名单 |
| [组合复盘](./docs/workflow-portfolio-review.md) | 持仓、盈亏，以及是什么在驱动它 |
| [创作者收益](./docs/workflow-creator-earnings.md) | 创作者赚到了什么，以及为什么还没到账 |

## 命令

命令与参数本身不翻译。完整参考见英文版 [Readme.md](./Readme.md#commands)，或直接运行：

```bash
moonrush-cli --help
moonrush-cli <命令> --help
```

## 认证

两种方式，面向不同的机器。

**浏览器，用于你的笔记本。**

```bash
moonrush-cli login
```

一次点击。会话约一小时，存续期间自动续期。

**API key，用于服务器、CI 或助手。** 无需浏览器，不过期。

```bash
moonrush-cli config --generate-key     # 生成密钥对，私钥留在本机，权限 600
# 把公钥粘贴到 https://moonrush.space/ai/keys
moonrush-cli config --apply-key <key id>.<secret>
```

⚠️ **私钥绝不离开你的机器，也绝不上传。** 控制台只保存公钥，所以服务端持有的东西能验证签名，
却无法伪造签名。那个页面上任何索要私钥的提示都不正常。

**key 分两档。** `read` 只读公开行情，只需 key id。任何属于某个人的数据，也就是你的钱包、仓位、
收益与领取，都需要开启「Trading and private data」，并对每个请求的路径、查询、请求体和时间戳签名。
所以单独泄露 key id 只能读到公开榜单，而被截获的请求也无法重放或改写。

这条分界不是「读与写」：`rewards me` 和 `wallet portfolio` 都是读取，却都在高权限档，因为让一次调用
变危险的，是返回的是谁的数据。

`token verified`、`token check` 和 `market config` 完全不需要凭证。

## 安全

代币的名称、符号和描述由发行者自己填写，而在一个给助手用的 CLI 里，它们会直接进入模型的上下文。
客户端会剥掉不可见字符（bidi 覆盖、零宽连接符、Unicode tag block），让隐藏文本无法对模型说一套、
对人说另一套。它不去识别「指令」：那种过滤器会被绕过，还会顺手吃掉正常的代币文案。

地址永不改写。

`rewards claim`、`trade buy`、`trade sell` 和 `orders create` 会动用资金（委托是稍后自己触发），
`mooncall post` 会以用户名义发布。每一个都会先显示确切金额或文本，在终端上询问，没有终端就拒绝执行。
`--yes` 是给本人在自己机器上输入用的；技能明确要求助手永不传它。

动态与评论里的人写的文字（帖子、简介、昵称）与代币元数据同等清洗。

## 开发

```bash
npm ci && npm run build && npm test
```

CI 在 Node 20 和 24 上运行构建与测试，并检查每个技能的 frontmatter 与其目录名一致。

## 许可

MIT
