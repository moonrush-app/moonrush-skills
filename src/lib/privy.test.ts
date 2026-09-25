import { describe, expect, test, afterEach } from "bun:test";
import { PrivyAuthExpired, refreshPrivySession } from "./privy";


/** A JWT with only the claims this code reads. Signature is never checked here. */
function jwtFor(aud: string, att?: string): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "ES256" })}.${b64(att ? { aud, att } : { aud })}.sig`;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function answers(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status })) as typeof fetch;
}

const call = () =>
  refreshPrivySession({
    refreshToken: "refresh-1",
    accessToken: "access-old",
    appId: "app",
    clientId: "client",
    origin: "https://trade.moonrush.space",
  });

describe("session_update_action", () => {
  test("`set` replaces BOTH tokens", () => {
    answers(200, {
      session_update_action: "set",
      privy_access_token: jwtFor("app"),
      refresh_token: "refresh-2",
    });
    return call().then((s) => {
      expect(s.accessToken).toBe(jwtFor("app"));
      expect(s.refreshToken).toBe("refresh-2");
    });
  });

  test("`ignore` returns NO refresh token, so the caller keeps the one it has", () => {
    // THE TRAP THIS PINS. Privy sends `ignore` when it is renewing only the access token,
    // and the response carries no refresh token. A caller that wrote the absent value over
    // its stored one would destroy the only credential that can mint the next access
    // token: the session would die at the next expiry with no way back, looking exactly
    // like "refresh does not work".
    answers(200, {
      session_update_action: "ignore",
      privy_access_token: jwtFor("app"),
    });
    return call().then((s) => {
      expect(s.accessToken).toBe(jwtFor("app"));
      expect(s.refreshToken).toBeNull();
      expect(s.updateAction).toBe("ignore");
    });
  });

  test("`ignore` ignores a refresh token even if one is present", () => {
    // Belt and braces: the action decides, not the presence of the field. If Privy ever
    // echoes the old token back on an `ignore`, storing it is still wrong in principle and
    // would mask the case above if the behaviour changed.
    answers(200, {
      session_update_action: "ignore",
      privy_access_token: jwtFor("app"),
      refresh_token: "refresh-echoed",
    });
    return call().then((s) => expect(s.refreshToken).toBeNull());
  });

  test("`clear` is the end of the session, not a retry", () => {
    answers(200, {
      session_update_action: "clear",
      privy_access_token: jwtFor("app"),
    });
    return call().then(
      () => {
        throw new Error("should have thrown");
      },
      (e) => expect(e).toBeInstanceOf(PrivyAuthExpired),
    );
  });
});

describe("failures", () => {
  test("missing_or_invalid_token is terminal, not transient", () => {
    // Kept apart from every other error because it asks something different of the reader:
    // sign in again, rather than try again.
    answers(400, { code: "MISSING_OR_INVALID_TOKEN" });
    return call().then(
      () => {
        throw new Error("should have thrown");
      },
      (e) => expect(e).toBeInstanceOf(PrivyAuthExpired),
    );
  });

  test("a 500 is an ordinary error, and does NOT read as a dead session", () => {
    answers(500, { message: "upstream" });
    return call().then(
      () => {
        throw new Error("should have thrown");
      },
      (e) => {
        expect(e).not.toBeInstanceOf(PrivyAuthExpired);
        expect(String(e.message)).toContain("500");
      },
    );
  });

  test("a 200 with no token for this app is a failure, not a silent empty session", () => {
    answers(200, { session_update_action: "set" });
    return call().then(
      () => {
        throw new Error("should have thrown");
      },
      (e) => expect(String(e.message)).toContain("no token for this app"),
    );
  });
});

describe("the request", () => {
  test("carries every header Privy requires", () => {
    let seen: Request | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = new Request(url, init);
      return new Response(
        JSON.stringify({
          session_update_action: "set",
          privy_access_token: jwtFor("app"),
          refresh_token: "r",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    return call().then(() => {
      // Each of these is required and each is a PUBLIC value: they ship in the web
      // bundle. Missing one is refused, which is the failure that reads as "refresh is
      // not possible from a terminal".
      expect(seen!.headers.get("privy-app-id")).toBe("app");
      expect(seen!.headers.get("privy-client-id")).toBe("client");
      expect(seen!.headers.get("privy-client")).toBe("react-auth:3.16.0");
      expect(seen!.headers.get("origin")).toBe("https://trade.moonrush.space");
      expect(seen!.headers.get("authorization")).toBe("Bearer access-old");
    });
  });
});

describe("what the live endpoint actually returns", () => {
  test("the access token can arrive as `token` with `privy_access_token` null", async () => {
    // MEASURED, NOT ASSUMED. A real successful refresh came back
    // { token: <jwt>, privy_access_token: null, session_update_action: "ignore" }.
    // Reading only the documented name threw "Privy returned no access token" at a
    // response that was carrying one the whole time, one field over. Every test above this
    // one used privy_access_token, so the suite agreed with the bug.
    answers(200, {
      session_update_action: "ignore",
      privy_access_token: null,
      token: jwtFor("app"),
      refresh_token: "echoed",
    });
    const s = await call();
    expect(s.accessToken).toBe(jwtFor("app"));
    expect(s.refreshToken).toBeNull();
  });

  test("the documented name still wins when both are present", async () => {
    answers(200, {
      session_update_action: "set",
      privy_access_token: jwtFor("app"),
      token: "other",
      refresh_token: "r",
    });
    expect((await call()).accessToken).toBe(jwtFor("app"));
  });

  test("neither field carries an app token, and the message says what did arrive", async () => {
    // A bare "no access token" sent me reading the REQUEST for an hour. What disagreed was
    // the response, so the response is what the message describes.
    answers(200, { session_update_action: "set", user: {} });
    try {
      await call();
      throw new Error("should have thrown");
    } catch (e) {
      const m = String((e as Error).message);
      expect(m).toContain("session_update_action: set");
      expect(m).toContain("audiences offered: none, none");
    }
  });

  test("a wrong origin is a 403 with its own reason, not a dead session", async () => {
    // Privy answers 403 { code: "invalid_origin" } when the origin does not match the one
    // the session was issued to. It must NOT read as an expired session: the tokens are
    // fine and the fix is one flag, not a fresh sign-in.
    answers(403, { error: "Origin not allowed", code: "invalid_origin" });
    try {
      await call();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).not.toBeInstanceOf(PrivyAuthExpired);
      expect(String((e as Error).message)).toContain("403");
    }
  });
});

describe("whose fault the 401 is", () => {
  test("no access token sent is OUR mistake, not a dead session", async () => {
    // Privy sends `missing_or_invalid_token` for BOTH "you sent none" and "the one you
    // sent is dead", so the code cannot separate them. We can, because we know what we
    // sent. Getting this backwards told somebody holding a perfectly good refresh token
    // to go and sign in again, which is the most expensive wrong advice available.
    answers(401, { error: "Missing access token", code: "missing_or_invalid_token" });
    try {
      await refreshPrivySession({
        refreshToken: "refresh-1",
        accessToken: "",
        appId: "app",
        clientId: "client",
        origin: "https://app.moonrush.space",
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).not.toBeInstanceOf(PrivyAuthExpired);
      expect(String((e as Error).message)).toContain("even an expired one");
    }
  });

  test("the same answer IS terminal once we did send one", async () => {
    answers(401, { error: "Invalid token", code: "missing_or_invalid_token" });
    await expect(call()).rejects.toBeInstanceOf(PrivyAuthExpired);
  });
});


describe("the audience decides, not the field name", () => {
  const APP = jwtFor("app");
  const PAT = jwtFor("https://auth.privy.io", "pat");

  test("a PAT in privy_access_token is refused", async () => {
    // MEASURED. With an EXPIRED app token as Bearer, Privy put its PAT in the documented
    // field and left `token` null. Reading the field name would have stored it.
    answers(200, { session_update_action: "ignore", privy_access_token: PAT, token: null });
    try {
      await call();
      throw new Error("should have thrown");
    } catch (e) {
      expect(String((e as Error).message)).toContain("auth.privy.io");
      expect(String((e as Error).message)).toContain("unchanged");
    }
  });

  test("a PAT in token is refused too", async () => {
    // The same session an hour earlier, with a VALID app token as Bearer, put the PAT in
    // the other field. Privy moves it; the audience does not move.
    answers(200, { session_update_action: "ignore", privy_access_token: null, token: PAT });
    await expect(call()).rejects.toThrow("auth.privy.io");
  });

  test("an app-audience token is taken from EITHER field", async () => {
    answers(200, { session_update_action: "set", privy_access_token: APP, refresh_token: "r" });
    expect((await call()).accessToken).toBe(APP);
    answers(200, { session_update_action: "set", privy_access_token: null, token: APP, refresh_token: "r" });
    expect((await call()).accessToken).toBe(APP);
  });

  test("the message names the audiences it was offered", async () => {
    // A bare "no access token" sent me reading the request for an hour. What disagreed was
    // the response, so the response is what the message describes.
    answers(200, { session_update_action: "ignore", privy_access_token: PAT, token: null });
    try {
      await call();
    } catch (e) {
      expect(String((e as Error).message)).toContain("audiences offered");
    }
  });
});
