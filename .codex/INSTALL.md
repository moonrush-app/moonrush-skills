# Installing moonrush-cli skills for Codex

Codex discovers skills natively. Clone, symlink, configure.

## Prerequisites

- Git and Node 20 or newer
- A signed-in Moonrush session to copy credentials from. **There is no API key.** Moonrush
  authenticates with Privy, so the tokens come out of a browser once and the CLI refreshes
  them after that.

## Installation

1. **Clone:**

   ```bash
   git clone https://github.com/moonrush/moonrush-skills ~/.codex/moonrush-cli
   ```

2. **Build the CLI** (it ships as TypeScript in the repo):

   ```bash
   cd ~/.codex/moonrush-cli && npm ci && npm run build && npm link
   ```

   `npm link` puts `moonrush-cli` on your PATH. `npm install -g moonrush-cli` works too if
   you would rather take the published build.

3. **Symlink the skills:**

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/moonrush-cli/skills ~/.agents/skills/moonrush-cli
   ```

   **Windows (PowerShell):**

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\moonrush-cli" "$env:USERPROFILE\.codex\moonrush-cli\skills"
   ```

4. **Configure credentials:**

   ```bash
   moonrush-cli config
   ```

   It points you at https://app.moonrush.space/cli, which prints the whole command with
   a copy button while you are signed in:

   ```bash
   moonrush-cli config --apply <ACCESS_TOKEN> \
     --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID>
   ```

   Stored at `~/.config/moonrush/.env`, mode 600, outside any project directory.

   ⚠️ **Supply the refresh token.** The access token alone gives you about an hour. With
   the refresh token the CLI mints new ones itself and keeps working for as long as the
   Privy session lives.

5. **Restart Codex** so it picks up the skills.

## Verify

```bash
ls -la ~/.agents/skills/moonrush-cli
moonrush-cli market config          # public, needs no token
moonrush-cli config --check         # exit 0 when credentials work
```

## Available skills

| Skill | Use when |
|---|---|
| `moonrush-token` | Token detail, search by name, the Verified roster |
| `moonrush-market` | Trending / Movers / New boards, live fee and limit config |
| `moonrush-wallet` | Balances, portfolio, deposits, value over time, activity |
| `moonrush-positions` | Trades: own, public, top, and who holds a token |
| `moonrush-leaderboard` | PnL rankings over 24h / 7d / 30d / all time |
| `moonrush-rewards` | Creator earnings, and claiming them |

## Updating

```bash
cd ~/.codex/moonrush-cli && git pull && npm ci && npm run build
```

## Uninstalling

```bash
rm ~/.agents/skills/moonrush-cli
rm -rf ~/.codex/moonrush-cli        # optional
rm ~/.config/moonrush/.env          # revokes nothing; delete the session in the app too
```
