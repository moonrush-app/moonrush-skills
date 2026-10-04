import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SocialModule from "./social";
import type * as ConfirmModule from "../lib/confirm";

/** Feed, mooncalls and follows against a fake API. Imported after the config dir is moved. */
let social: typeof SocialModule;
let Refused: typeof ConfirmModule.Refused;
const POSITION = "655b739e-3c38-4a82-a236-5dc705dbd4cd";
let calls: { method: string; path: string; body: unknown }[] = [];
let printed = "";
const realFetch = globalThis.fetch;
const realWrite = process.stdout.write.bind(process.stdout);
const realIsTTY = process.stdin.isTTY;

beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), "mr-social-"));
  process.env.MOONRUSH_CONFIG_DIR = join(home, "moonrush");
  // AN API KEY, because that is the only credential the client takes now. It routes through
  // the gateway rather than the API base, so both point at the one host this mock answers
  // for; the assertion below that every request lands on `api.test` still holds.
  process.env.MOONRUSH_API_KEY = "testkey.testsecret";
  process.env.MOONRUSH_API_BASE = "https://api.test";
  process.env.MOONRUSH_GATEWAY_BASE = "https://api.test";
  delete process.env.MOONRUSH_TOKEN;
  social = await import("./social");
  ({ Refused } = await import("../lib/confirm"));
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(url.toString());
    if (u.host !== "api.test") throw new Error(`unexpected host ${u.host}`);
    calls.push({ method: init?.method ?? "GET", path: u.pathname + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = u.pathname.startsWith("/users/by-username/")
      ? { userId: "bd02deec-a096-59cf-972f-46dde4cc84bd" }
      : { items: [{ id: "c1", body: "buy​ now", user: { displayName: "x‮" } }] };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  }) as typeof fetch;
  process.stdout.write = ((s: string) => {
    printed += s;
    return true;
  }) as typeof process.stdout.write;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  process.stdout.write = realWrite;
});

afterEach(() => {
  calls = [];
  printed = "";
  Object.defineProperty(process.stdin, "isTTY", { value: realIsTTY, configurable: true });
});

describe("mooncall", () => {
  test("post with no terminal and no --yes publishes nothing", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await expect(social.runMooncall("post", { positionId: POSITION, text: "moon soon" })).rejects.toBeInstanceOf(Refused);
    expect(calls).toEqual([]);
  });

  test("with --yes it posts the text, and a reply carries its parent", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await social.runMooncall("post", { positionId: POSITION, text: " moon soon ", parentId: POSITION, yes: true });
    expect(calls[0]).toMatchObject({ method: "POST", path: `/positions/${POSITION}/comments`, body: { body: "moon soon", parentId: POSITION } });
  });

  test("a thread is printed with people's text cleaned", async () => {
    await social.runMooncall("read", { positionId: POSITION });
    expect(printed).toContain('"body": "buy now"');
    expect(printed).not.toContain("​");
    expect(printed).not.toContain("‮");
  });
});

describe("feed and follow", () => {
  test("kinds are checked before any request", async () => {
    await expect(social.runFeed("posts", { kinds: "comment,likes" })).rejects.toThrow(/comment, repost, trade/);
    expect(calls).toEqual([]);
  });

  test("a username is resolved to the id the follow takes", async () => {
    await social.runFollow("add", { username: "@miadang" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /users/by-username/miadang",
      "POST /users/bd02deec-a096-59cf-972f-46dde4cc84bd/follow",
    ]);
  });
});
