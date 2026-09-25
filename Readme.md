# moonrush-skills

Moonrush's API as a CLI, plus the skills that teach an agent to use it.

## Install

```
npm install -g moonrush-cli
moonrush-cli config
```

As an agent plugin:

```
npx skills add moonrush/moonrush-skills
```

## Auth, and its one real limitation

Moonrush authenticates with **Privy**. There is no API key and no device flow: Privy issues
its token to a signed-in browser or app, so the CLI holds a copy.

⚠️ **The token expires, usually within the hour, and cannot be refreshed from a terminal.**
When commands start answering 401, get a fresh one and re-apply it. That is the auth design,
not a defect in the CLI — and it is why long-running automation is not currently possible
without a backend change.

`moonrush-cli config` prints the steps. The token is stored at `~/.config/moonrush/.env`,
mode 600. Environment variables override the file, so `MOONRUSH_TOKEN=… moonrush-cli …`
needs no file and leaves nothing behind.

Three commands need no token at all: `token verified`, `token check`, `market config`.

## Why a CLI rather than letting the agent call HTTP

The API answers in **two different envelopes** — `{ok, data}` on most routes and
`{success, responseObject}` on every `/proxy/*` route. A hand-written request reads
`undefined` off the wrong one and does not error while doing it. The client unwraps both,
and every skill can then be about the domain instead of about parsing.

## Layout

```
src/              the CLI
skills/<name>/SKILL.md   one skill each
.claude-plugin/   plugin + marketplace manifests
```
