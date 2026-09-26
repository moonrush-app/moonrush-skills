import { CONFIG_FILE, loadConfig, saveConfig } from "../lib/config.js";
import { api, ApiError } from "../lib/api.js";
import { checkFlags } from "../lib/validate.js";
import { generateKeypair, loadPrivateKey, PRIVATE_KEY_PATH } from "../lib/keypair.js";

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
    --refresh <REFRESH_TOKEN> --app-id <APP_ID> --client-id <CLIENT_ID> \\
    --origin https://app.moonrush.space

Stored at ~/.config/moonrush/.env, mode 600.

The access token alone also works, and gives you about an hour before commands start
answering 401. The refresh token is what removes that.`;

export async function runConfig(
  flags: Record<string, string | true>,
): Promise<number> {
  checkFlags(
    flags,
    ["apply", "refresh", "app-id", "client-id", "origin", "check", "generate-key", "force", "apply-key"],
    "config",
  );

  /**
   * Make a signing keypair and print the half that leaves this machine.
   *
   * ⚠️ ONLY THE PUBLIC HALF IS PRINTED, and saying so where somebody is about to copy
   * something is the point. The private key is written to disk at mode 600 and is never
   * shown, never uploaded, and never needed by anyone but this CLI.
   */
  if (flags["generate-key"]) {
    const { privateKeyPath, publicKeyPem } = generateKeypair(flags.force === true);
    process.stdout.write(
      `Private key written to ${privateKeyPath} (mode 600).\n` +
        `It never leaves this machine. Do not copy it anywhere.\n\n` +
        `Paste THIS at https://ai.moonrush.space/keys:\n\n` +
        publicKeyPem +
        `\nThen apply the key it gives you back:\n\n` +
        `  moonrush-cli config --apply-key <key id>.<secret>\n`,
    );
    return 0;
  }

  const applyKey = flags["apply-key"];
  if (typeof applyKey === "string") {
    const key = applyKey.trim();
    if (!/^[a-f0-9]{32}\.[A-Za-z0-9_-]{20,}$/.test(key)) {
      process.stderr.write(
        "That does not look like an API key. It is `<key id>.<secret>`, exactly as the\n" +
          "console printed it, and the console shows it only once.\n",
      );
      return 1;
    }
    saveConfig({ MOONRUSH_API_KEY: key });

    // Said now rather than at the first failed call. A key with trade scope and no signing
    // key answers "must be signed" on every private endpoint, which reads as a server
    // problem if nobody mentioned the pair.
    const signing = loadPrivateKey()
      ? `Signing key found at ${PRIVATE_KEY_PATH}.\n`
      : `⚠️ No signing key at ${PRIVATE_KEY_PATH}. Public market data will work; anything\n` +
        `   private will not. Run: moonrush-cli config --generate-key\n`;

    /**
     * ⚠️ VERIFY WITH A READ ENDPOINT, NOT `/users`.
     *
     * This checked `/users` first, and `/users` is in the `trade` tier. So a perfectly good
     * read-only key, which is the kind the console makes by default, reported "the key did
     * not work" every single time. The key worked; the check was asking it to do something
     * it was never granted.
     *
     * `/config` needs only `read`, so it proves the thing actually in question: that the
     * gateway found this key, matched its secret and accepted it.
     */
    try {
      await api("/config");
    } catch (e) {
      process.stderr.write(
        `Saved to ${CONFIG_FILE}, but the key did not work: ${
          e instanceof Error ? e.message : String(e)
        }\n` + signing,
      );
      return 1;
    }

    // Now a SEPARATE question, reported rather than judged: does this key also hold
    // `trade`? A refusal here is information about the key, not a failure of it.
    let tier = "read only. Public market data.";
    try {
      const me = await api<{ username?: string; userId?: string }>("/users");
      tier =
        `read + trade, as ${me.username ? "@" + me.username : (me.userId ?? "your account")}.\n` +
        `   This key can move money. Treat it like one.`;
    } catch {
      /* Expected for a read key, and not an error. */
    }

    process.stdout.write(
      `Saved to ${CONFIG_FILE}\n` + `Key works, ${tier}\n` + signing,
    );
    return 0;
  }

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
      // The origin the tokens were issued to. Privy checks it and answers
      // `403 Origin not allowed` on a mismatch, so it belongs beside the tokens rather
      // than in a default that has to be right for everybody.
      MOONRUSH_PRIVY_ORIGIN: str(flags.origin),
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
            ? "Session renews itself; no need to sign in again while it lives.\n"
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
      `  origin   ${cfg.privyOrigin}\n` +
      `  gateway  ${cfg.gatewayBase}\n` +
      `  api key  ${cfg.apiKey ? `set (${cfg.apiKey.split(".")[0]}…)` : "not set"}\n` +
      `  signing  ${loadPrivateKey() ? PRIVATE_KEY_PATH : "no key generated"}\n` +
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
