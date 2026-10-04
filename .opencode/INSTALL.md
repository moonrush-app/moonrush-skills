# Installing moonrush-cli skills for OpenCode

OpenCode discovers skills natively. Most people should not read this file: one command does
all of it.

```bash
npx skills add moonrush-app/moonrush-skills
```

What follows is the same thing by hand, for a checkout you want to edit or pin.

## Prerequisites

- Git and Node 20 or newer
- An API key from https://moonrush.space/ai/keys

**One credential, and no browser.** The key does not expire, works the same on a laptop
and in CI, and is revocable from that page. Public market data needs only the key id;
anything that is one person's also needs a signature, which the CLI makes locally from a
private key that never leaves the machine.

## Installation

1. **Clone:**

   ```bash
   git clone https://github.com/moonrush-app/moonrush-skills ~/.opencode/moonrush-cli
   ```

2. **Build the CLI** (it ships as TypeScript in the repo):

   ```bash
   cd ~/.opencode/moonrush-cli && npm ci && npm run build && npm link
   ```

   `npm link` puts `moonrush-cli` on your PATH. `npm install -g moonrush-cli` works too if
   you would rather take the published build.

3. **Symlink the skills:**

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.opencode/moonrush-cli/skills ~/.agents/skills/moonrush-cli
   ```

   **Windows (PowerShell):**

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\moonrush-cli" "$env:USERPROFILE\.opencode\moonrush-cli\skills"
   ```

4. **Make a keypair and apply the key:**

   ```bash
   moonrush-cli config --generate-key
   # paste the PUBLIC key at https://moonrush.space/ai/keys
   moonrush-cli config --apply-key <key id>.<secret>
   ```

   The private half is written to `~/.config/moonrush/signing-key.pem` at mode 600 and is
   never uploaded, including to that page. The key itself lands in
   `~/.config/moonrush/.env`, also mode 600, outside any project directory.

   ⚠️ **Nothing will ever ask you for the private key.** Anything that does is not us.

   ⚠️ **The secret is shown once.** The console stores a hash, so there is no second copy
   to go back for. Lose it and the answer is to revoke the key and make another.

5. **Restart OpenCode** so it picks up the skills.

## Verify

```bash
ls -la ~/.agents/skills/moonrush-cli
moonrush-cli market config          # public, needs no credentials at all
moonrush-cli config --check         # exit 0 when the key works
```

## Available skills

Seventeen. The full table, with what each is for, is in the
[Readme](../Readme.md#skills); the short version:

| Group | Skills |
|---|---|
| Tokens | `moonrush-token`, `moonrush-token-dd`, `moonrush-token-buy` |
| Discovery | `moonrush-market` |
| Portfolio | `moonrush-wallet`, `moonrush-wallet-score`, `moonrush-positions`, `moonrush-send` |
| Trading | `moonrush-trade`, `moonrush-bracket` |
| Research | `moonrush-holder-analysis`, `moonrush-kline-pattern`, `moonrush-dev-score`, `moonrush-smart-money` |
| Social | `moonrush-social` |
| Rankings | `moonrush-leaderboard` |
| Earnings | `moonrush-rewards` |

## Updating

```bash
cd ~/.opencode/moonrush-cli && git pull && npm ci && npm run build
```

## Uninstalling

```bash
rm ~/.agents/skills/moonrush-cli
rm -rf ~/.opencode/moonrush-cli         # optional
rm ~/.config/moonrush/.env          # revokes nothing: revoke the key at /ai/keys too
rm ~/.config/moonrush/signing-key.pem
```
