import { CONFIG_FILE, loadConfig, saveConfig } from "../lib/config.js";
import { api, ApiError } from "../lib/api.js";
import { checkFlags } from "../lib/validate.js";

/**
 * How somebody gets a token, written where they will be when they need it.
 *
 * There is no device flow and no API key: Moonrush authenticates with Privy, which issues
 * its token to a browser or an app and rotates it there. A terminal can hold a copy and
 * nothing more, so the honest instruction is "copy it from a place you are already signed
 * in", and the honest warning is that it expires.
 */
const HOW_TO = `Moonrush authenticates with Privy. The CLI keeps a Privy SESSION, not just a
token: given a refresh token it mints new access tokens itself, so it keeps working for as
long as the session lives rather than for the hour an access token lasts.

Open this in a browser where you are signed in:

  https://app.moonrush.space/cli

It shows the whole \`config --apply\` command with a copy button. Paste it here.

⚠️ That page displays a LONG-LIVED credential. Do not screen share it, and do not paste
the command anywhere but your own terminal.

If you would rather read the values yourself, they are in the POST to
auth.privy.io/api/v1/sessions: \`privy_access_token\` and \`refresh_token\` in the
response, \`privy-app-id\` and \`privy-client-id\` in the request headers.

  moonrush-cli config --apply <ACCESS_TOKEN> \\
    --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID>

Stored at ~/.config/moonrush/.env, mode 600.

The access token alone also works, and gives you about an hour before commands start
answering 401. The refresh token is what removes that.`;

export async function runConfig(
  flags: Record<string, string | true>,
): Promise<number> {
  checkFlags(flags, ["apply", "refresh", "app-id", "client-id", "check"], "config");

  const apply = flags.apply;
  if (typeof apply === "string") {
    const token = apply.trim().replace(/^Bearer\s+/i, "");
    if (!token) {
      process.stderr.write("A token is required: --apply <TOKEN>\n");
      return 1;
    }

    const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
    saveConfig({
      MOONRUSH_TOKEN: token,
      MOONRUSH_REFRESH_TOKEN: str(flags.refresh),
      MOONRUSH_PRIVY_APP_ID: str(flags["app-id"]),
      MOONRUSH_PRIVY_CLIENT_ID: str(flags["client-id"]),
    });

    // VERIFIED, not just stored. Writing a bad token and reporting success moves the
    // failure to whichever command runs next, where it reads as that command being broken.
    try {
      const me = await api<{ userId?: string; username?: string }>("/users");
      const cfg = loadConfig();
      const renewable = Boolean(
        cfg.refreshToken && cfg.privyAppId && cfg.privyClientId,
      );
      process.stdout.write(
        `Saved to ${CONFIG_FILE}\n` +
          `Verified as ${me.username ? "@" + me.username : (me.userId ?? "an account")}\n` +
          (renewable
            ? "Session renews itself; no need to paste again while it lives.\n"
            : "⚠️ No refresh token stored. This will stop working in about an hour.\n" +
              "   Re-run with --refresh, --app-id and --client-id to keep it alive.\n"),
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
      `  token    ${cfg.token ? `set (${cfg.token.slice(0, 12)}…)` : "NOT SET"}\n` +
      // Three states, not two. With no token at all there is nothing to expire, and
      // saying "expires in about an hour" about it sends the reader looking for a token
      // that was never there.
      `  renews   ${
        cfg.refreshToken && cfg.privyAppId && cfg.privyClientId
          ? "yes, refresh token stored"
          : cfg.token
            ? "NO, this access token expires in about an hour"
            : "-"
      }\n`,
  );
  return 0;
}
