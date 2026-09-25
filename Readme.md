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

## Auth

Moonrush authenticates with **Privy**. The CLI keeps a **session**, not just a token: given
a refresh token it calls `POST auth.privy.io/api/v1/sessions` itself and mints a new access
token whenever one expires.

So it keeps working for as long as the Privy session lives, rather than for the hour an
access token lasts.

```
moonrush-cli config --apply <ACCESS_TOKEN> \
  --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID>
```

`moonrush-cli config` prints where to find each of those. Stored at
`~/.config/moonrush/.env`, mode 600 — the refresh token is the long-lived credential, so
treat that file as a secret. Environment variables override the file.

An access token on its own also works and gives about an hour.

⚠️ **`session_update_action: "ignore"` means keep the refresh token you have.** Privy sends
it when it is renewing only the access token, and writing the response's absent refresh
token over the stored one destroys the session. The config writer merges rather than
replaces for exactly this reason.

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
