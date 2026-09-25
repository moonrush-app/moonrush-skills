import { loadConfig } from "./config.js";

/**
 * One HTTP client for an API that answers in TWO envelopes.
 *
 * Most routes answer `{ ok, data }`. The `/proxy/*` routes answer
 * `{ success, responseObject }` — a different shape for the same idea, and a client that
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

  /**
   * The one failure worth its own message.
   *
   * A Privy token expires within the hour and cannot be refreshed from a terminal, so a 401
   * here is almost never "wrong credentials" — it is "the same credentials, an hour later".
   * Saying so turns a debugging session into a copy and paste.
   */
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

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const cfg = loadConfig();
  const base = opts.admin ? cfg.adminBase : cfg.apiBase;

  if (!opts.anonymous && !cfg.token) {
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
