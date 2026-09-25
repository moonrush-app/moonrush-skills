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
   * refresh token, and writing whatever it did carry — usually nothing — over the stored one
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
 * browser bundle, and `origin` has to be one Privy recognises for this app — which is why it
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
    // The one refusal that is terminal. Anything else may be transient and is worth a
    // retry; this one means the refresh token itself is gone and only a fresh sign-in
    // helps, so it is a different class of error rather than a worse message.
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

  const accessToken = body.privy_access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Privy returned no access token");
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
