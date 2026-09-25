import { loadConfig, saveConfig } from "./config.js";
import { PrivyAuthExpired, refreshPrivySession } from "./privy.js";

/**
 * One HTTP client for an API that answers in TWO envelopes.
 *
 * Most routes answer `{ ok, data }`. The `/proxy/*` routes answer
 * `{ success, responseObject }`: a different shape for the same idea, and a client that
 * knows only one silently reads `undefined` off the other. Both are unwrapped here so no
 * command has to care which it called.
 *
 * Errors come in two shapes too: `{ ok: false, error: { code, message } }` on most routes,
 * and `{ ok: false, error: "a string" }` on a few older handlers. Both are read.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** A 401 that survived a refresh attempt, so re-applying credentials is the only fix. */
  get isExpiredAuth(): boolean {
    return this.status === 401;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  /** The admin console rather than the app API. */
  admin?: boolean;
  /** For the handful of routes that need no token. */
  anonymous?: boolean;
}

/**
 * Mint a new access token from the stored refresh token, and keep it.
 *
 * Returns null when there is nothing to refresh WITH, which is a different situation from a
 * refresh that failed: the first needs credentials, the second needs a sign-in.
 */
async function tryRefresh(): Promise<string | null> {
  const cfg = loadConfig();
  if (!cfg.refreshToken || !cfg.privyAppId || !cfg.privyClientId) return null;

  const session = await refreshPrivySession({
    refreshToken: cfg.refreshToken,
    accessToken: cfg.token,
    appId: cfg.privyAppId,
    clientId: cfg.privyClientId,
    origin: cfg.privyOrigin,
  });

  saveConfig({
    MOONRUSH_TOKEN: session.accessToken,
    // ONLY when Privy sent a new one. On `ignore` it did not, and `saveConfig` skips
    // undefined rather than clearing the field, which is the whole reason it merges.
    MOONRUSH_REFRESH_TOKEN: session.refreshToken ?? undefined,
  });
  return session.accessToken;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  return request<T>(path, opts, true);
}

async function request<T>(
  path: string,
  opts: Options,
  mayRefresh: boolean,
): Promise<T> {
  const cfg = loadConfig();
  const base = opts.admin ? cfg.adminBase : cfg.apiBase;

  if (!opts.anonymous && !cfg.token) {
    // No access token at all, but possibly a refresh token: mint one rather than telling
    // somebody to go and paste what we can fetch ourselves.
    if (mayRefresh) {
      const minted = await tryRefresh().catch(() => null);
      if (minted) return request<T>(path, opts, false);
    }
    throw new ApiError(
      "No token configured. Run `moonrush-cli config` for how to get one.",
      401,
    );
  }

  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.anonymous ? {} : { authorization: `Bearer ${cfg.token}` }),
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // NEVER `credentials: "include"`. The backend sends `origin: "*"` with
    // `credentials: true`, a combination browsers refuse outright; auth travels in the
    // header and a reflex to add cookies here would break nothing visibly and confuse
    // anybody reading a failed request later.
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      `${res.status} and the body was not JSON: ${text.slice(0, 200)}`,
      res.status,
    );
  }

  const body = parsed as {
    ok?: boolean;
    data?: unknown;
    success?: boolean;
    responseObject?: unknown;
    error?: unknown;
  } | null;

  // ONE retry, and only on a 401. An access token expiring mid-session is the ordinary
  // case, not an error worth surfacing; anything else is a real failure and retrying it
  // would just take twice as long to report.
  if (res.status === 401 && mayRefresh && !opts.anonymous) {
    try {
      const minted = await tryRefresh();
      if (minted) return request<T>(path, opts, false);
    } catch (e) {
      if (e instanceof PrivyAuthExpired) {
        throw new ApiError(e.message, 401, "PRIVY_SESSION_ENDED");
      }
      /**
       * ⚠️ SAY WHY THE REFRESH FAILED. This used to fall through to the original 401 on the
       * reasoning that it was "the more useful of the two messages". It was not.
       *
       * The refresh was answering `403 Origin not allowed` for every session taken from the
       * web app, because the default origin named the mobile client. That is a one-line
       * fix and the message says exactly which line. Swallowed, it surfaced as
       * "401. No usable credentials. Run: moonrush-cli config", which sends the reader to
       * re-paste credentials that were never the problem, and to do it again the next time.
       *
       * The 401 is still printed underneath, because it is also true.
       */
      process.stderr.write(
        `Could not refresh the session: ${
          e instanceof Error ? e.message : String(e)
        }\n`,
      );
    }
  }

  if (!res.ok || body?.ok === false || body?.success === false) {
    const err = body?.error;
    const message =
      typeof err === "string"
        ? err
        : ((err as { message?: string })?.message ?? `HTTP ${res.status}`);
    throw new ApiError(
      message,
      res.status,
      typeof err === "object" ? (err as { code?: string })?.code : undefined,
    );
  }

  // `responseObject` first: a `/proxy` response carries `success` and not `ok`, so testing
  // for `data` would return undefined for every one of them.
  if (body && "responseObject" in body) return body.responseObject as T;
  if (body && "data" in body) return body.data as T;
  return body as T;
}
