import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { saveConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { checkFlags } from "../lib/validate.js";

/**
 * Sign in by opening a browser, the way every other CLI does it.
 *
 * WHAT THIS REPLACES. `config --apply` asks somebody to carry two secrets through a
 * clipboard. That is not a Privy limitation: the web app is already signed in and already
 * holds the tokens, so the only reason they were travelling by hand is that nothing was
 * listening for them.
 *
 * So: bind a port on loopback, open the browser at it, and let the page post the session
 * back. No backend endpoint, no device code, nothing for anyone to read off a screen.
 *
 * ⚠️ IT IS A FORM POST, NOT `fetch`. Two reasons, and both are about what browsers refuse:
 *
 *   - A `fetch` from `https://app.moonrush.space` to `http://127.0.0.1` is a mixed-content
 *     request. Chrome and Firefox carve out loopback; Safari has not reliably, and a
 *     sign-in that works in two browsers out of three is a sign-in that gets reported as
 *     broken. A top-level navigation is not subject to mixed-content blocking at all.
 *   - A form POST puts the tokens in the BODY. A redirect with query parameters would put
 *     a long-lived credential in browser history, in the address bar, and in any extension
 *     that watches navigation.
 */

const TIMEOUT_MS = 3 * 60_000;
const WEB_BASE = "https://app.moonrush.space";

/** Same value, in constant time, without leaking the length comparison. */
function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    // Detached and ignored: the browser outliving this process is the point, and its
    // stdout would otherwise interleave with ours.
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    /* Printed below either way, so a machine with no opener still works. */
  }
}

const DONE_PAGE = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:16px system-ui;margin:0;display:grid;place-items:center;height:100vh;background:#0b0b0c;color:#eee">` +
  `<div style="text-align:center"><h1 style="font-size:20px;margin:0 0 8px">${title}</h1>` +
  `<p style="opacity:.7;margin:0">${body}</p></div>`;

export async function runLogin(
  flags: Record<string, string | true>,
): Promise<number> {
  checkFlags(flags, ["web", "timeout"], "login");

  const state = randomBytes(32).toString("base64url");
  const webBase = typeof flags.web === "string" ? flags.web : WEB_BASE;

  const result = await new Promise<{
    ok: boolean;
    message: string;
    fields?: Record<string, string>;
  }>((resolve) => {
    const server = createServer((req, res) => {
      if (req.method !== "POST" || !req.url?.startsWith("/callback")) {
        res.writeHead(404).end();
        return;
      }
      let body = "";
      req.on("data", (c) => {
        body += c;
        // A callback is a few hundred bytes. Anything larger is not our page.
        if (body.length > 16_000) req.destroy();
      });
      req.on("end", () => {
        const f = Object.fromEntries(new URLSearchParams(body));
        // THE STATE IS THE WHOLE CHECK. Without it any page in any tab could post to this
        // port while it is open and have the CLI store whatever it sent.
        if (!f.state || !sameState(f.state, state)) {
          res.writeHead(400, { "content-type": "text/html" }).end(
            DONE_PAGE("That did not match", "Close this tab and run the command again."),
          );
          return;
        }
        res.writeHead(200, { "content-type": "text/html" }).end(
          DONE_PAGE("Signed in", "You can close this tab and go back to your terminal."),
        );
        resolve({ ok: true, message: "", fields: f });
        setImmediate(() => server.close());
      });
    });

    // LOOPBACK ONLY. Binding 0.0.0.0 would accept a callback from anything on the network
    // while the window is open.
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const url = `${webBase}/cli?port=${port}&state=${encodeURIComponent(state)}`;
      process.stderr.write(
        `Opening ${webBase}/cli in your browser.\n` +
          `If it did not open, paste this:\n\n  ${url}\n\n` +
          `Waiting for you to approve it (listening on 127.0.0.1:${port})...\n`,
      );
      openBrowser(url);
    });

    const ms =
      typeof flags.timeout === "string" ? Number(flags.timeout) * 1000 : TIMEOUT_MS;
    const timer = setTimeout(() => {
      server.close();
      resolve({ ok: false, message: "Timed out waiting for the browser." });
    }, ms);
    server.on("close", () => clearTimeout(timer));
    server.on("error", (e) =>
      resolve({ ok: false, message: `Could not open a local port: ${e.message}` }),
    );
  });

  if (!result.ok || !result.fields) {
    process.stderr.write(`${result.message}\n`);
    return 1;
  }

  const f = result.fields;
  if (!f.access_token) {
    process.stderr.write("The page sent no access token.\n");
    return 1;
  }

  saveConfig({
    MOONRUSH_TOKEN: f.access_token,
    MOONRUSH_REFRESH_TOKEN: f.refresh_token || undefined,
    MOONRUSH_PRIVY_APP_ID: f.app_id || undefined,
    MOONRUSH_PRIVY_CLIENT_ID: f.client_id || undefined,
    // The origin the page was served from. Privy checks it on every refresh, so taking it
    // from the page rather than a default is what makes the refresh work at all.
    MOONRUSH_PRIVY_ORIGIN: f.origin || undefined,
  });

  // VERIFIED, not just stored. Saving a token and reporting success moves the failure to
  // whichever command runs next, where it reads as that command being broken.
  try {
    const me = await api<{ userId?: string; username?: string }>("/users");
    process.stdout.write(
      `Signed in as ${me.username ? "@" + me.username : (me.userId ?? "an account")}\n` +
        // NOT "the session renews itself". A refresh token is stored and the CLI will try,
        // but Privy decides whether to issue a replacement and has not been observed doing
        // so. Promising renewal would make the hour-later 401 look like a new bug.
        (f.refresh_token
          ? "Good for about an hour. A refresh token is stored and the CLI will try to\n" +
            "renew; if a command answers 401, run this again.\n"
          : "⚠️ No refresh token was available, so this expires in about an hour.\n"),
    );
    return 0;
  } catch (e) {
    process.stderr.write(
      `Saved, but the token did not work: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return 1;
  }
}
