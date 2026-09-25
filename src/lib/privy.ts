/**
 * Refreshing a Privy session from outside a browser.
 *
 * Privy's session endpoint is plain REST and the headers it needs are public values, so a
 * terminal can renew a session the same way any client does. A stored refresh token means
 * commands keep working for as long as the session lives, instead of until the access
 * token expires about an hour after somebody pasted it.
 */

const PRIVY_BASE = "https://auth.privy.io";

export interface PrivySession {
  accessToken: string;
  /** Null when the server told us to keep the one we already have. See [updateAction]. */
  refreshToken: string | null;
  /**
   * `set` replace both tokens · `ignore` replace ONLY the access token · `clear` the session
   * is over.
   *
   * ⚠️ `ignore` IS NOT A NO-OP AND NOT A SUGGESTION. On it the response carries no new
   * refresh token, and writing whatever it did carry (usually nothing) over the stored one
   * destroys the only credential that can produce the next access token. The session would
   * then end at the next expiry with no way back, which looks exactly like "refresh does not
   * work", which is the wrong conclusion to reach about it.
   */
  updateAction: "set" | "ignore" | "clear";
}

export interface PrivyIds {
  appId: string;
  clientId: string;
}

export class PrivyAuthExpired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivyAuthExpired";
  }
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Every header below is required and none is a secret: the app id and client id ship in the
 * browser bundle, and `origin` has to be one Privy recognises for this app, which is why it
 * is a configured value rather than something invented here.
 */
export async function refreshPrivySession(
  p: {
    refreshToken: string;
    /** The expiring one. Privy wants it alongside the refresh token, not instead of it. */
    accessToken?: string;
    origin: string;
  } & PrivyIds,
): Promise<PrivySession> {
  const res = await fetch(`${PRIVY_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "privy-app-id": p.appId,
      "privy-client-id": p.clientId,
      // The client string the app sends. Privy uses it to decide which auth flow it is
      // talking to; an unrecognised one is refused.
      "privy-client": "react-auth:3.16.0",
      origin: p.origin,
      ...(p.accessToken ? { authorization: `Bearer ${p.accessToken}` } : {}),
    },
    body: JSON.stringify({ refresh_token: p.refreshToken }),
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Privy answered ${res.status} with a non-JSON body`);
  }

  if (!res.ok) {
    const code = String(body.code ?? "").toLowerCase();

    /**
     * ⚠️ A 401 HERE IS NOT AUTOMATICALLY A DEAD REFRESH TOKEN.
     *
     * Privy wants the access token alongside the refresh token, even an expired one, and
     * answers 401 when the Authorization header is missing entirely. Mapping every 401 to
     * "the refresh token is no longer valid" told somebody with a perfectly good refresh
     * token to go and sign in again, which is both wrong and the most expensive advice
     * available.
     *
     * So the terminal case is the code Privy actually sends for it, plus a 401 that came
     * back while we DID authenticate. A 401 with nothing sent is a different sentence.
     */
    // OUR FAULT FIRST. Privy sends `missing_or_invalid_token` for BOTH "you sent none" and
    // "the one you sent is dead", so the code cannot tell them apart. We can: we know
    // whether we sent one. Checking that first is what keeps a local mistake from being
    // reported as the user's session having ended.
    if (res.status === 401 && !p.accessToken) {
      throw new Error(
        "Privy needs the access token alongside the refresh token, even an expired one, " +
          "and none is stored. Re-apply with --apply and --refresh together.",
      );
    }
    if (code === "missing_or_invalid_token" || res.status === 401) {
      throw new PrivyAuthExpired(
        "The refresh token is no longer valid. Sign in again and re-apply.",
      );
    }
    throw new Error(
      `Privy refresh failed: ${res.status} ${String(body.message ?? text.slice(0, 200))}`,
    );
  }

  const action = String(body.session_update_action ?? "set");
  if (action === "clear") {
    throw new PrivyAuthExpired("Privy ended this session. Sign in again.");
  }

  /**
   * TWO KEYS, AND THE DOCUMENTED ONE CAN BE NULL.
   *
   * Measured against the live endpoint: a successful refresh came back
   * `{ token: <jwt>, privy_access_token: null, session_update_action: "ignore" }`. Reading
   * only `privy_access_token` threw "Privy returned no access token" on a response that
   * was carrying one the whole time, one field over.
   *
   * `token` is read second rather than first only because `privy_access_token` is the name
   * Privy's own docs use; neither is optional to handle.
   */
  const accessToken =
    (typeof body.privy_access_token === "string" && body.privy_access_token) ||
    (typeof body.token === "string" && body.token) ||
    null;
  if (!accessToken) {
    throw new Error(
      `Privy returned no access token (action: ${action}, keys: ${Object.keys(body).join(", ")})`,
    );
  }

  return {
    accessToken,
    // Only on `set`. See the note on `updateAction`.
    refreshToken:
      action === "set" && typeof body.refresh_token === "string"
        ? body.refresh_token
        : null,
    updateAction: action === "ignore" ? "ignore" : "set",
  };
}
