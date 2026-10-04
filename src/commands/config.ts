import { CONFIG_FILE, loadConfig, saveConfig } from "../lib/config.js";
import { api, ApiError } from "../lib/api.js";
import { checkFlags } from "../lib/validate.js";
import { generateKeypair, loadPrivateKey, PRIVATE_KEY_PATH } from "../lib/keypair.js";

/**
 * How somebody gets a credential, written where they will be when they need it.
 *
 * One way in, and no browser: a key made on the console, with its signing half generated
 * here. So this text is the whole path, which is why it is a constant and not scattered
 * across the error messages that send people to it.
 */
const HOW_TO = `Moonrush authenticates with an API KEY, made at
https://moonrush.space/ai/keys. There is no browser sign-in here: that kept a long-lived
credential to a whole account in a file, and a key is scoped, revocable from that page, and
signed by a private half that never leaves this machine.

  moonrush-cli config --generate-key                  # keypair, private half stays here
  # paste the PUBLIC key at https://moonrush.space/ai/keys
  moonrush-cli config --apply-key <key id>.<secret>

Keys have two tiers. \`read\` is public market data and needs only the key id. Anything that
is one person's (wallet, positions, earnings, trading) needs "Trading and private data" on the
key AND the signing keypair above.`;

export async function runConfig(
  flags: Record<string, string | true>,
): Promise<number> {
  checkFlags(
    flags,
    ["check", "generate-key", "force", "apply-key"],
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
        `Paste THIS at https://moonrush.space/ai/keys:\n\n` +
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

  /**
   * `--check` exists for the SKILL, not for a person: an agent runs it first and branches
   * on the exit code rather than parsing prose.
   *
   * ⚠️ CHECKED WITH `/config`, NOT `/users`. `/users` is in the `trade` tier, so a
   * read-only API key answers 403 to it, this returned 1, and every skill would then tell
   * the user their credentials were broken. They were not. The check was asking a
   * perfectly good key to do something it was never granted, which is the same mistake
   * `--apply-key` made.
   *
   * `/config` is the one endpoint every credential can reach, so it answers the question
   * actually being asked: can this CLI talk to the API as somebody.
   */
  if (flags.check) {
    const cfg = loadConfig();
    if (!cfg.apiKey) return 1;
    try {
      await api("/config");
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
      `  gateway  ${cfg.gatewayBase}\n` +
      `  api key  ${cfg.apiKey ? `set (${cfg.apiKey.split(".")[0]}…)` : "NOT SET"}\n` +
      `  signing  ${loadPrivateKey() ? PRIVATE_KEY_PATH : "no key generated"}\n`,
  );
  return 0;
}
