<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

[English](./Readme.md) ·
[简体中文](./Readme.zh-CN.md) ·
[Français](./Readme.fr.md) ·
**한국어** ·
[日本語](./Readme.ja.md)

[![Console](https://img.shields.io/badge/console-moonrush.space%2Fai-7C3AED)](https://moonrush.space/ai)
[![npm](https://img.shields.io/npm/v/moonrush-cli?color=5865F2&label=moonrush-cli)](https://www.npmjs.com/package/moonrush-cli)
[![X](https://img.shields.io/badge/X-@moonrush__space-000000?logo=x&logoColor=white)](https://x.com/moonrush_space)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/vD66uhAG3h)
[![Telegram](https://img.shields.io/badge/Telegram-announcements-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_space_app)
[![Telegram](https://img.shields.io/badge/Telegram-chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_spacechat)

</div>

Moonrush Agent Skills를 쓰면 AI 에이전트에게 자연어로 이런 것들을 물어볼 수 있습니다. Solana,
Robinhood Chain, Base, BNB, Soneium, Arc의 실시간 발견 보드, 토큰 펀더멘털과 이름이 붙은 위험 판정,
Verified 명단, 아무 차트의 기술적 해석, 집중도와 신규 고래를 포함한 전체 보유자 목록, 생성자가 이전에
띄운 모든 토큰으로 매긴 이력 점수, 어떤 지갑이든 숙련·운·봇·개발자로 분류하는 점수, 그리고 PnL
리더보드 상위권이 지금 무엇을 들고 있는지.

다른 온체인 데이터 도구에는 없는 부분도 있습니다. Moonrush 자체가 소셜 거래소이므로, 같은 에이전트가
피드와 특정 트레이더의 타임라인, 포지션에 달린 mooncall과 팔로우 관계를 읽고, 크리에이터에게 자기
콜을 보고 거래한 사람들로부터 얼마를 벌었는지 알려줍니다.

트레이딩은 일급 기능이며 실제 돈이 움직입니다. 견적, 시장가 매수와 매도, 지정가 주문, 익절, 손절과 그
트레일링 변형, 한 흐름에서 양쪽 출구를 모두 걸어두는 bracket 진입, 그리고 잔고·기간별 포트폴리오
가치·입금·활동 기록까지. 돈을 쓰는 모든 경로는 먼저 견적을 내고 숫자를 보여준 뒤, 터미널 앞의 사람에게
확인을 받습니다.

> 영어 [Readme.md](./Readme.md)가 유일한 기준입니다. 내용이 어긋나면 영어판을 따릅니다.

## 설치

```bash
npm install -g moonrush-cli
moonrush-cli config
```

에이전트 플러그인으로:

```bash
npx skills add moonrush-app/moonrush-skills
```

Claude Code를 비롯해 `.claude-plugin`을 읽는 호스트라면 위 명령 하나로 끝납니다.

| 호스트 | 설치 |
|---|---|
| Claude Code, Codex, OpenCode, Cursor | `npx skills add moonrush-app/moonrush-skills` |
| Codex, 수동 | [.codex/INSTALL.md](./.codex/INSTALL.md) |
| OpenCode, 수동 | [.opencode/INSTALL.md](./.opencode/INSTALL.md) |
| Cursor | 패키지에 [.cursor-plugin/plugin.json](./.cursor-plugin/plugin.json)이 들어 있습니다. Cursor가 이 저장소나 설치된 npm 패키지를 보도록 설정하세요 |

## 자연어로 물어보기

이 저장소의 핵심은 스킬입니다. 설치하고 나면 에이전트에게 말을 걸고, 스킬과 명령은 에이전트가
고릅니다.

| 이렇게 말하면 | 이것을 씁니다 |
|---|---|
| "PENGU 오늘 어때?" | `moonrush-token`, 그다음 차트와 위험 판정 |
| "이 토큰 점수 내줘: `<주소>`" | `moonrush-token-dd`, 0에서 100, 깎인 이유를 하나씩 |
| "누가 들고 있고, 얼마나 쏠려 있어?" | `moonrush-holder-analysis` |
| "이 개발자가 전에 뭘 띄운 적 있어?" | `moonrush-dev-score` |
| "이 지갑 따라갈 만해? `<주소>`" | `moonrush-wallet-score` |
| "지금 잘하는 사람들이 뭘 들고 있어?" | `moonrush-smart-money` |
| "이 차트 좀 읽어줘" | `moonrush-kline-pattern` |
| "`<토큰>` 25달러어치 사줘" | `moonrush-token-buy`: 토큰 확정, 빠른 실사, 금액, 견적, 그리고 확인 요청 |
| "X 50달러 사고 +40% 익절, -20% 손절" | `moonrush-bracket`: 매수, 그다음 양쪽 출구 |
| "내 포지션 중에 손절 없는 건?" | [포지션 리스크](./docs/workflow-position-risk.md) 워크플로 |
| "내 콜로 얼마 벌었고 왜 안 들어왔어?" | `moonrush-rewards` |

말 한마디로 돈이 움직이는 일은 없습니다. 스킬은 먼저 견적을 내고 숫자를 보여주며 터미널에서 묻고,
`--yes`를 넘기지 않도록 명시되어 있습니다.

## 스킬

| 스킬 | 범위 |
|---|---|
| `moonrush-token` | 토큰 상세, 이름 검색, Verified 명단 |
| `moonrush-market` | Trending / Movers / New 보드, 실시간 수수료 설정 |
| `moonrush-wallet` | 잔고, 포트폴리오, 입금, 기간별 가치, 활동 |
| `moonrush-positions` | 거래: 내 것, 공개된 것, 상위, 그리고 누가 그 토큰을 들고 있는지 |
| `moonrush-leaderboard` | 24시간 / 7일 / 30일 / 전체 기간 손익 순위 |
| `moonrush-rewards` | 크리에이터 수익과 수령 |
| `moonrush-trade` | 견적, 매수, 매도; 지정가·익절·손절·트레일링 주문 |
| `moonrush-token-dd` | 토큰 실사 점수 0에서 100, 깎인 이유를 하나씩 명시 |
| `moonrush-social` | 피드, 트레이더 타임라인, 포지션 스레드, mooncall, 팔로우 |
| `moonrush-kline-pattern` | 차트의 기술적 해석: 추세, 스윙 레벨, 거래량, 규칙이 붙은 패턴 |
| `moonrush-smart-money` | 리더보드 상위 트레이더의 현재 보유, 보유자 수로 정렬 |
| `moonrush-token-buy` | "X 좀 사줘"에서 체결까지: 토큰 확정, 빠른 실사, 금액 산정, 견적, 매수 |
| `moonrush-holder-analysis` | 전체 보유자 목록, 집중도, 신규 고래, 풀과 소각 |
| `moonrush-dev-score` | 생성자가 이전에 띄운 전부로 매긴 0에서 100 점수 |
| `moonrush-wallet-score` | 지갑의 온체인 거래 이력을 점수로: 숙련, 운, 봇, 개발자 |
| `moonrush-bracket` | 한 흐름에서 진입과 양쪽 출구까지: 매수, 그다음 익절과 손절 |

## 워크플로

명령을 엮어 하나의 답을 만드는 다단계 레시피:

| 워크플로 | 용도 |
|---|---|
| [토큰 리서치](./docs/workflow-token-research.md) | 이름이나 주소에서 말할 가치가 있는 결론까지 |
| [데일리 브리핑](./docs/workflow-daily-brief.md) | 내 포지션, 체결된 주문, 팔로우가 한 일, 무엇이 움직였는지 |
| [트레이더 프로필](./docs/workflow-trader-profile.md) | 따라갈 만한가: 이력, 집중도, 체결 가능성 |
| [포지션 리스크](./docs/workflow-position-risk.md) | 보호 없는 보유는 무엇이고, 어떤 손절을 제안할지 |
| [시장 기회](./docs/workflow-market-opportunities.md) | 모든 체인에서 걸러낸 후보 목록 |
| [포트폴리오 리뷰](./docs/workflow-portfolio-review.md) | 보유, 손익, 그리고 그것을 움직이는 요인 |
| [크리에이터 수익](./docs/workflow-creator-earnings.md) | 얼마를 벌었고, 왜 아직 안 들어왔는지 |

## 명령

명령과 옵션 자체는 번역하지 않습니다. 전체 참조는 영어
[Readme.md](./Readme.md#commands)에 있고, 바로 보려면:

```bash
moonrush-cli --help
moonrush-cli <명령> --help
```

## 인증

두 가지 방식이며, 서로 다른 기기를 위한 것입니다.

**브라우저, 노트북용.**

```bash
moonrush-cli login
```

클릭 한 번. 세션은 약 한 시간이며 살아 있는 동안 스스로 갱신됩니다.

**API 키, 서버·CI·에이전트용.** 브라우저 없이, 만료 없이.

```bash
moonrush-cli config --generate-key     # 키 쌍 생성, 비밀키는 이 기기에 mode 600으로 남습니다
# 공개키를 https://moonrush.space/ai/keys 에 붙여넣기
moonrush-cli config --apply-key <key id>.<secret>
```

⚠️ **비밀키는 절대 기기를 떠나지 않고, 절대 업로드되지 않습니다.** 콘솔은 공개키만 저장하므로,
서버가 가진 것으로는 서명을 검증할 수 있을 뿐 서명을 만들 수는 없습니다. 그 페이지에서 비밀키를
요구하는 일은 결코 정상이 아닙니다.

**키는 두 단계입니다.** `read`는 공개 시장 데이터이며 키 id만 필요합니다. 한 사람에게 속한 것, 즉
지갑·포지션·수익과 그 수령은 "Trading and private data"가 켜져 있어야 하고, 매 요청의 경로·쿼리·본문·
타임스탬프에 대한 서명이 필요합니다. 그래서 키 id만 새어 나가면 공개 보드만 읽히고, 가로챈 요청은
재생이나 변조가 불가능합니다.

이 경계는 읽기와 쓰기의 구분이 아닙니다. `rewards me`와 `wallet portfolio`는 둘 다 읽기지만 상위
단계에 속합니다. 호출을 위험하게 만드는 것은 돌아오는 데이터가 누구의 것인가이기 때문입니다.

`token verified`, `token check`, `market config`는 자격 증명이 전혀 필요하지 않습니다.

**환경 변수, 컨테이너나 CI용.** 설정 파일 없이 같은 자격 증명을 쓰며, 둘 다 있으면 환경 변수가
이깁니다. [.env.example](./.env.example)을 `~/.config/moonrush/.env`로 복사하거나 export 하세요.

| 변수 | 설명 |
|---|---|
| `MOONRUSH_TOKEN` | 단기 액세스 토큰. 단독으로 약 한 시간 동작합니다. |
| `MOONRUSH_REFRESH_TOKEN` | 장기 자격 증명. 이것이 있으면 CLI가 스스로 갱신하며 Privy 세션이 살아 있는 동안 계속 동작합니다. **비밀로 다루세요.** |
| `MOONRUSH_PRIVY_APP_ID`, `MOONRUSH_PRIVY_CLIENT_ID` | 공개 값. Privy 세션 호출의 요청 헤더에서 가져옵니다. |
| `MOONRUSH_API_BASE` | 선택. 기본값 `https://social.moonrush.space`. |

## 안전

토큰의 이름·심볼·설명은 토큰을 배포한 사람이 직접 쓴 것이고, 에이전트용 CLI에서는 그것이 모델의
컨텍스트로 바로 들어옵니다. 클라이언트는 보이지 않는 문자(bidi 오버라이드, 제로폭 조이너, 유니코드
tag block)를 제거해, 숨은 텍스트가 모델에게 한 말과 사람에게 보이는 말이 다를 수 없게 합니다. 지시문을
탐지하려 들지는 않습니다. 그런 필터는 우회되고, 정상적인 토큰 문구까지 잡아먹습니다.

주소는 결코 바꿔 쓰지 않습니다.

`rewards claim`, `trade buy`, `trade sell`, `orders create`는 돈을 움직이고(주문은 나중에 스스로),
`mooncall post`는 사용자 이름으로 게시합니다. 각각 정확한 금액이나 문구를 먼저 보여주고 터미널에서
확인을 받으며, 터미널이 없으면 거부합니다. `--yes`는 본인이 자기 기기에서 직접 입력할 때를 위한
것이고, 스킬은 에이전트가 그것을 넘기지 않도록 명시합니다.

피드와 스레드에 사람이 쓴 글(게시물, 소개, 표시 이름)도 토큰 메타데이터와 같은 방식으로 정리됩니다.

## 개발

```bash
npm ci && npm run build && npm test
```

CI는 Node 20과 24에서 빌드와 테스트를 돌리고, 각 스킬의 frontmatter가 디렉터리 이름과 일치하는지
확인합니다.

## 하지 않는 것

이걸 중심으로 통합을 설계하기 전에 알아둘 만합니다. 아래 항목은 모두 API에는 있지만 여기에는
아직 명령이 없습니다.

- **돈을 밖으로 보내지 않습니다.** `wallet deposits`는 입금할 주소만 알려주고, 여기에는 자금을
  어디로든 보내는 명령이 없습니다. 출금과 송금은 API의 `/transfer/*`와 `/rh/send`이며, 어떤
  명령도 그것을 호출하지 않습니다.
- **실시간 스트림이 없습니다.** API에는 소켓이 여섯 개 있습니다(gateway, chart, intent,
  trending, verified, discovery). CLI 프로세스는 연결을 계속 붙잡고 있지 않으므로 모든 스킬이
  폴링합니다. 에이전트에게는 보통 이게 맞는 선택입니다. 다시 묻는 건 싸고, 돌봐야 하는 연결은
  싸지 않습니다.
- **퍼프가 없습니다.** API에 `/perps`가 있지만 이를 다루는 스킬은 없습니다.
- **알림이 없습니다.** 여기서는 읽지도, 보내지도 않습니다.

## 링크

- 키를 만드는 콘솔: [moonrush.space/ai](https://moonrush.space/ai)
- 릴리스와 변경 내역: [releases](https://github.com/moonrush-app/moonrush-skills/releases)
- 문제가 있거나 원하는 명령이 있으면: [이슈 열기](https://github.com/moonrush-app/moonrush-skills/issues)
- [X](https://x.com/moonrush_space) · [Discord](https://discord.gg/vD66uhAG3h) · [Telegram](https://t.me/moonrush_space_app)

PR 환영합니다. 새 스킬에는 `name`이 디렉터리 이름과 일치하는 `SKILL.md`가 필요하고 CI가 이를
확인하며, 이 저장소는 em dash를 쓰지 않고 그것도 CI가 확인합니다.

## 라이선스

MIT
