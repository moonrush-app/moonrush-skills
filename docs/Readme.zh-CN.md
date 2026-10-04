<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

[English](../Readme.md) ·
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

> 英文版 [Readme.md](../Readme.md) 是唯一权威版本。本页若与之不一致，以英文版为准。

## 安装

```bash
npm install -g moonrush-cli
moonrush-cli config
```

作为助手插件：

```bash
npx skills add moonrush-app/moonrush-skills
```

支持读取 `.claude-plugin` 的宿主（含 Claude Code）：上面那条命令就够了。

| 宿主 | 安装 |
|---|---|
| Claude Code、Codex、OpenCode、Cursor | `npx skills add moonrush-app/moonrush-skills` |
| Codex，手动 | [.codex/INSTALL.md](../.codex/INSTALL.md) |
| OpenCode，手动 | [.opencode/INSTALL.md](../.opencode/INSTALL.md) |
| Cursor | 包内带有 [.cursor-plugin/plugin.json](../.cursor-plugin/plugin.json)，把 Cursor 指向本仓库或已安装的 npm 包 |

## 用自然语言提问

技能才是这个仓库的重点。装好之后你对助手说话，由它挑技能和命令：

| 你说 | 它会去用 |
|---|---|
| 「PENGU 今天怎么样？」 | `moonrush-token`，然后看图和风险判定 |
| 「给这个代币打分：`<地址>`」 | `moonrush-token-dd`，0 到 100，每项扣分都写明 |
| 「谁在持有它，集中度高吗？」 | `moonrush-holder-analysis` |
| 「这个开发者以前发过币吗？」 | `moonrush-dev-score` |
| 「这个钱包值得跟吗？`<地址>`」 | `moonrush-wallet-score` |
| 「现在最会赚的人在拿什么？」 | `moonrush-smart-money` |
| 「帮我读一下这张图」 | `moonrush-kline-pattern` |
| 「买 25 美元的 `<代币>`」 | `moonrush-token-buy`：解析、快速尽调、定量、报价，然后问你 |
| 「买 50 美元 X，+40% 止盈，-20% 止损」 | `moonrush-bracket`：先买入，再挂两个出场单 |
| 「我哪些仓位没有止损？」 | [仓位风险](./workflow-position-risk.md) 工作流 |
| 「我的喊单赚了多少，为什么还没到账？」 | `moonrush-rewards` |

没有任何花钱的动作会只凭一句话就发生。技能会先报价、把数字摆出来、在终端上问你，并且被明确要求
永不传 `--yes`。

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
| [代币研究](./workflow-token-research.md) | 从一个名称或地址，到真正值得说的结论 |
| [每日简报](./workflow-daily-brief.md) | 自己的持仓、已触发的委托、关注的人做了什么、什么在动 |
| [交易者画像](./workflow-trader-profile.md) | 该不该跟这个人：记录、集中度、能否成交 |
| [仓位风险](./workflow-position-risk.md) | 哪些持仓没有保护，并给出止损建议 |
| [市场机会](./workflow-market-opportunities.md) | 跨全部链筛出的候选名单 |
| [组合复盘](./workflow-portfolio-review.md) | 持仓、盈亏，以及是什么在驱动它 |
| [创作者收益](./workflow-creator-earnings.md) | 创作者赚到了什么，以及为什么还没到账 |

## 命令

命令与参数本身不翻译。完整参考见英文版 [Readme.md](../Readme.md#commands)，或直接运行：

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

**环境变量，用于容器或 CI。** 同样的凭证，不需要配置文件，且两者同时存在时环境变量优先。把
[.env.example](../.env.example) 复制到 `~/.config/moonrush/.env`，或者直接 export：

| 变量 | 含义 |
|---|---|
| `MOONRUSH_TOKEN` | 短期访问令牌，单独可用约一小时。 |
| `MOONRUSH_REFRESH_TOKEN` | 长期凭证。有了它，CLI 会自动续期，只要 Privy 会话还活着就一直可用。**请当作机密对待。** |
| `MOONRUSH_PRIVY_APP_ID`、`MOONRUSH_PRIVY_CLIENT_ID` | 公开值，取自 Privy 会话请求的头部。 |
| `MOONRUSH_API_BASE` | 可选，默认 `https://social.moonrush.space`。 |

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

## 它不做什么

在围绕它做集成之前值得先知道。下面每一项在 API 里都存在，只是这里还没有对应命令。

- **不往外转钱。** `wallet deposits` 只告诉你钱该往哪里充，这里没有任何命令把钱转出去。提现和
  转账是 API 的 `/transfer/*` 和 `/rh/send`，没有命令调用它们。
- **没有实时流。** API 有六个 socket（gateway、chart、intent、trending、verified、discovery）。
  CLI 进程不会一直挂着连接，所以所有技能都用轮询。对助手来说这通常是对的取舍：再问一次很便宜，
  而要照看的长连接并不便宜。
- **没有永续合约。** API 有 `/perps`，这里没有技能覆盖。
- **没有通知。** 这里既不读也不发。

## 链接

- 生成 key 的控制台：[moonrush.space/ai](https://moonrush.space/ai)
- 版本与变更：[releases](https://github.com/moonrush-app/moonrush-skills/releases)
- 有问题，或想要某条命令：[提交 issue](https://github.com/moonrush-app/moonrush-skills/issues)
- [X](https://x.com/moonrush_space) · [Discord](https://discord.gg/vD66uhAG3h) · [Telegram](https://t.me/moonrush_space_app)

欢迎 PR。新增技能需要一个 `SKILL.md`，其 `name` 必须与目录名一致（CI 会检查），并且本仓库风格
不使用 em dash（CI 同样会检查）。

## 许可

MIT
