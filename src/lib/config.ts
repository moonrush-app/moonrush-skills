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
   * A Privy access token.
   *
   * ⚠️ IT EXPIRES, typically within the hour, and there is no refresh path here: Privy
   * rotates it in a browser or an app, not in a terminal. That is a real limitation rather
   * than an oversight, and every command says so when it sees a 401 instead of reporting a
   * generic failure the user would go and debug.
   */
  token?: string;
  /** The API origin. Overridable so a developer can point at a preview deployment. */
  apiBase: string;
  /** The admin console origin, for the admin-only commands. */
  adminBase: string;
}

const DEFAULTS = {
  apiBase: "https://social.moonrush.space",
  adminBase: "https://moonrush-admin.contact-9ba.workers.dev",
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
    apiBase: pick("MOONRUSH_API_BASE") ?? DEFAULTS.apiBase,
    adminBase: pick("MOONRUSH_ADMIN_BASE") ?? DEFAULTS.adminBase,
  };
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
