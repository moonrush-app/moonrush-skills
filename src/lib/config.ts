import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

/**
 * Where credentials live, and why not in the project.
 *
 * `~/.config/moonrush/.env`, mode 600. A token in a project directory is a token one
 * `git add -A` away from a public repository, and this one is a bearer credential for a
 * product that moves money.
 */
export const CONFIG_DIR = join(homedir(), ".config", "moonrush");
export const CONFIG_FILE = join(CONFIG_DIR, ".env");

export interface Config {
  /**
   * A Privy access token. Short-lived: about an hour.
   *
   * On its own it is a one-hour CLI. With [refreshToken] beside it the client renews it
   * automatically and the session lasts as long as Privy keeps it alive.
   */
  token?: string;

  /**
   * The Privy refresh token, which is what makes this usable.
   *
   * ⚠️ THE LONG-LIVED CREDENTIAL. The access token beside it expires in an hour and is
   * worth little; this one mints replacements for as long as the session lives, so it is
   * the file's reason for being mode 600.
   */
  refreshToken?: string;

  /** Privy app and client ids. Public values; they ship in the web bundle. */
  privyAppId?: string;
  privyClientId?: string;

  /**
   * The origin Privy is told the request came from.
   *
   * Must be one registered for this Privy app or the refresh is refused. Configurable
   * rather than hardcoded because the app and the web client use different ones.
   */
  privyOrigin: string;
  /** The API origin. Overridable so a developer can point at a preview deployment. */
  apiBase: string;
  /** The admin console origin, for the admin-only commands. */
  adminBase: string;
}

const DEFAULTS = {
  apiBase: "https://social.moonrush.space",
  adminBase: "https://moonrush-admin.contact-9ba.workers.dev",
  /**
   * ⚠️ MUST MATCH WHERE THE TOKENS CAME FROM. Privy checks it against the app's allowlist
   * and answers `403 Origin not allowed` otherwise, which is how this default was found to
   * be wrong: it was `trade.moonrush.space`, copied from the mobile client, while the
   * documented way to get a session is the web app on `app.moonrush.space`. Every refresh
   * from a browser-obtained token failed, and the failure was reported as a plain 401.
   *
   * `config --apply --origin` overrides it, and the setup page fills it in from its own
   * location so the question never has to be answered by hand.
   */
  privyOrigin: "https://app.moonrush.space",
};

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * The effective config.
 *
 * Environment variables WIN over the file, so a CI job or a one-off
 * `MOONRUSH_TOKEN=... moonrush-cli ...` needs no file at all and leaves nothing behind.
 */
export function loadConfig(): Config {
  const fromFile = existsSync(CONFIG_FILE)
    ? parseEnv(readFileSync(CONFIG_FILE, "utf8"))
    : {};
  const pick = (key: string) => process.env[key] ?? fromFile[key];
  return {
    token: pick("MOONRUSH_TOKEN"),
    refreshToken: pick("MOONRUSH_REFRESH_TOKEN"),
    privyAppId: pick("MOONRUSH_PRIVY_APP_ID"),
    privyClientId: pick("MOONRUSH_PRIVY_CLIENT_ID"),
    apiBase: pick("MOONRUSH_API_BASE") ?? DEFAULTS.apiBase,
    adminBase: pick("MOONRUSH_ADMIN_BASE") ?? DEFAULTS.adminBase,
    privyOrigin: pick("MOONRUSH_PRIVY_ORIGIN") ?? DEFAULTS.privyOrigin,
  };
}

/**
 * Merge fields into the config file, keeping everything already there.
 *
 * Merged rather than rewritten because a refresh writes ONE field: replacing the file with
 * just that field would drop the refresh token the next refresh needs, which is the exact
 * failure this whole path exists to avoid.
 */
export function saveConfig(patch: Record<string, string | undefined>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = existsSync(CONFIG_FILE)
    ? parseEnv(readFileSync(CONFIG_FILE, "utf8"))
    : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    existing[k] = v;
  }
  const body =
    "# Moonrush CLI. Written by `moonrush-cli config --apply`.\n" +
    "# MOONRUSH_REFRESH_TOKEN is the long-lived credential. Treat this file as a secret.\n" +
    Object.entries(existing)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n";
  writeFileSync(CONFIG_FILE, body, { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}

export function saveToken(token: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = existsSync(CONFIG_FILE)
    ? parseEnv(readFileSync(CONFIG_FILE, "utf8"))
    : {};
  existing.MOONRUSH_TOKEN = token;
  const body =
    "# Moonrush CLI. Written by `moonrush-cli config --apply`.\n" +
    "# A Privy access token, which EXPIRES. Re-apply when commands start answering 401.\n" +
    Object.entries(existing)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n";
  writeFileSync(CONFIG_FILE, body, { mode: 0o600 });
  // Set again explicitly: `writeFileSync`'s mode is masked by the process umask on an
  // existing file, so a file created before this ran keeps whatever it had.
  chmodSync(CONFIG_FILE, 0o600);
}
