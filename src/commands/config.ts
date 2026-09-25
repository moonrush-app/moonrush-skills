import { CONFIG_FILE, loadConfig, saveToken } from "../lib/config.js";
import { api, ApiError } from "../lib/api.js";

/**
 * How somebody gets a token, written where they will be when they need it.
 *
 * There is no device flow and no API key: Moonrush authenticates with Privy, which issues
 * its token to a browser or an app and rotates it there. A terminal can hold a copy and
 * nothing more, so the honest instruction is "copy it from a place you are already signed
 * in", and the honest warning is that it expires.
 */
const HOW_TO = `Moonrush uses Privy access tokens. There is no API key and no device flow:
Privy issues the token to a signed-in browser or app, so the CLI holds a copy.

To get one:
  1. Open the Moonrush web app and sign in:  https://app.moonrush.space
  2. Open DevTools, Network tab, and click any request to social.moonrush.space
  3. Copy the value after "Bearer " in the Authorization header

Then:
  moonrush-cli config --apply <TOKEN>

It is stored at ~/.config/moonrush/.env, mode 600.

⚠️ IT EXPIRES, usually within the hour, and cannot be refreshed from here. When commands
start answering 401, repeat the steps above. That is a limitation of the auth design, not
a bug in the CLI.`;

export async function runConfig(
  flags: Record<string, string | true>,
): Promise<number> {
  const apply = flags.apply;
  if (typeof apply === "string") {
    const token = apply.trim().replace(/^Bearer\s+/i, "");
    if (!token) {
      process.stderr.write("A token is required: --apply <TOKEN>\n");
      return 1;
    }
    saveToken(token);

    // VERIFIED, not just stored. Writing a bad token and reporting success moves the
    // failure to whichever command runs next, where it reads as that command being broken.
    try {
      const me = await api<{ userId?: string; username?: string }>("/users");
      process.stdout.write(
        `Saved to ${CONFIG_FILE}\n` +
          `Verified as ${me.username ? "@" + me.username : (me.userId ?? "an account")}\n`,
      );
      return 0;
    } catch (e) {
      process.stderr.write(
        `Saved to ${CONFIG_FILE}, but the token did not work: ${
          e instanceof Error ? e.message : String(e)
        }\n`,
      );
      return 1;
    }
  }

  // `--check` exists for the SKILL, not for a person: an agent runs it first and branches
  // on the exit code rather than parsing prose.
  if (flags.check) {
    const cfg = loadConfig();
    if (!cfg.token) return 1;
    try {
      await api("/users");
      process.stdout.write("ok\n");
      return 0;
    } catch (e) {
      if (e instanceof ApiError && e.isExpiredAuth) return 1;
      throw e;
    }
  }

  const cfg = loadConfig();
  process.stdout.write(
    `${HOW_TO}\n\nCurrent:\n` +
      `  api      ${cfg.apiBase}\n` +
      `  admin    ${cfg.adminBase}\n` +
      `  token    ${cfg.token ? `set (${cfg.token.slice(0, 12)}…)` : "NOT SET"}\n`,
  );
  return 0;
}
