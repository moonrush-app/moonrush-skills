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
/**
 * Where credentials live. `MOONRUSH_CONFIG_DIR` moves them: a second profile, a CI runner's
 * scratch directory, and the tests, which must never read or sign with the credentials of
 * the machine they run on.
 */
export const CONFIG_DIR =
  process.env.MOONRUSH_CONFIG_DIR || join(homedir(), ".config", "moonrush");
export const CONFIG_FILE = join(CONFIG_DIR, ".env");

export interface Config {
  /** The API origin. Overridable so a developer can point at a preview deployment. */
  apiBase: string;

  /**
   * An API key, as `<key id>.<secret>`, from https://moonrush.space/ai/keys.
   *
   * ⚠️ AN ALTERNATIVE TO THE PRIVY SESSION, NOT AN ADDITION. When this is set the client
   * talks to the gateway instead, which does not need a browser and does not expire in an
   * hour. That is the whole reason it exists: `login` needs a browser on the same machine,
   * which rules out CI and a server with no display.
   */
  apiKey?: string;

  /** Where the gateway lives. Overridable so a developer can point at a preview. */
  gatewayBase: string;
}

const DEFAULTS = {
  apiBase: "https://social.moonrush.space",
  /**
   * The gateway, on its own domain since 2026-10-04.
   *
   * It was `moonrush-ai-api.contact-9ba.workers.dev`, which worked and advertised the
   * account's internal naming to everybody who installed the package. A `workers.dev`
   * hostname is not a secret, and a default that ships in a tarball is not the place to
   * discover that: `ai.moonrush.space` answers identically and says nothing extra.
   */
  gatewayBase: "https://ai.moonrush.space",
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
    apiKey: pick("MOONRUSH_API_KEY"),
    gatewayBase: pick("MOONRUSH_GATEWAY_BASE") ?? DEFAULTS.gatewayBase,
    apiBase: pick("MOONRUSH_API_BASE") ?? DEFAULTS.apiBase,
  };
}

/**
 * Merge fields into the config file, keeping everything already there.
 *
 * Merged rather than rewritten so applying a key cannot drop a signing path or a base
 * somebody set by hand. It was written for a flow that saved one field at a time; the flow
 * is gone and the property is still the one worth having.
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
    "# Moonrush CLI. Written by `moonrush-cli config --apply-key`.\n" +
    "# MOONRUSH_API_KEY is a credential. Treat this file as a secret.\n" +
    Object.entries(existing)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n";
  writeFileSync(CONFIG_FILE, body, { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}
