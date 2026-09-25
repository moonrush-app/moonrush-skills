import { describe, expect, test, afterEach } from "bun:test";
import { PrivyAuthExpired, refreshPrivySession } from "./privy";

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
      privy_access_token: "access-new",
      refresh_token: "refresh-2",
    });
    return call().then((s) => {
      expect(s.accessToken).toBe("access-new");
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
      privy_access_token: "access-new",
    });
    return call().then((s) => {
      expect(s.accessToken).toBe("access-new");
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
      privy_access_token: "access-new",
      refresh_token: "refresh-echoed",
    });
    return call().then((s) => expect(s.refreshToken).toBeNull());
  });

  test("`clear` is the end of the session, not a retry", () => {
    answers(200, {
      session_update_action: "clear",
      privy_access_token: "irrelevant",
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

  test("a 200 with no access token is a failure, not a silent empty session", () => {
    answers(200, { session_update_action: "set" });
    return call().then(
      () => {
        throw new Error("should have thrown");
      },
      (e) => expect(String(e.message)).toContain("no access token"),
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
          privy_access_token: "a",
          refresh_token: "r",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    return call().then(() => {
      // Each of these is required and each is a PUBLIC value — they ship in the web
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
