import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, verify as edVerify } from "node:crypto";
import { buildMessage, signRequest } from "./sign";

const q = (s: string) => new URLSearchParams(s);

describe("the message matches what the gateway builds", () => {
  /**
   * ⚠️ WORKED EXAMPLES, SHARED WITH THE SERVER. This format exists twice, here and in
   * `workers/ai-api/src/signature.ts`, because a shared package would make this CLI depend
   * on the backend monorepo. Two copies can drift, and the only thing standing against that
   * is that both sides assert the same literal strings. Changing one of these without
   * changing the other is the bug this catches.
   */
  test("the exact bytes, for a call with no query and no body", () => {
    expect(buildMessage("/config", q(""), "", 1700000000)).toBe("/config:::1700000000");
  });

  test("the exact bytes, with query and body", () => {
    expect(
      buildMessage("/creator-rewards/claim", q("b=2&a=1"), '{"x":1}', 1700000000),
    ).toBe('/creator-rewards/claim:a=1&b=2:{"x":1}:1700000000');
  });

  test("repeated keys, sorted by value", () => {
    expect(buildMessage("/p", q("n=2&n=1"), "", 5)).toBe("/p:n=1&n=2::5");
  });

  test("a separator inside a value is encoded, so it cannot forge structure", () => {
    expect(buildMessage("/p", q("a=" + encodeURIComponent("x&b=y")), "", 1)).toBe(
      "/p:a=x%26b%3Dy::1",
    );
  });
});

describe("signing", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  test("the signature verifies over the message the server will rebuild", () => {
    const query = q("networkId=8453");
    const signed = signRequest({ path: "/wallet/portfolio", query, body: "", privateKeyPem: pem });

    // The server sees the query WITH timestamp and client_id in it, because the client put
    // them there before signing. Rebuilding it any other way is the commonest way to get a
    // "signature does not match" that is nobody's fault but the client's.
    const asSent = new URLSearchParams(query);
    asSent.set("timestamp", String(signed.timestamp));
    asSent.set("client_id", signed.clientId);

    const message = buildMessage("/wallet/portfolio", asSent, "", signed.timestamp);
    expect(
      edVerify(null, Buffer.from(message), publicKey, Buffer.from(signed.signature, "base64")),
    ).toBe(true);
  });

  test("a signature does not verify over a different path", () => {
    // The property the tier split rests on: a signature for a board read cannot be lifted
    // onto a payout.
    const signed = signRequest({ path: "/config", query: q(""), body: "", privateKeyPem: pem });
    const asSent = q(`timestamp=${signed.timestamp}&client_id=${signed.clientId}`);
    const other = buildMessage("/creator-rewards/claim", asSent, "", signed.timestamp);
    expect(
      edVerify(null, Buffer.from(other), publicKey, Buffer.from(signed.signature, "base64")),
    ).toBe(false);
  });

  test("a signature does not verify over a different body", () => {
    const body = '{"amount":"1"}';
    const signed = signRequest({ path: "/p", query: q(""), body, privateKeyPem: pem });
    const asSent = q(`timestamp=${signed.timestamp}&client_id=${signed.clientId}`);
    const tampered = buildMessage("/p", asSent, '{"amount":"1000"}', signed.timestamp);
    expect(
      edVerify(null, Buffer.from(tampered), publicKey, Buffer.from(signed.signature, "base64")),
    ).toBe(false);
  });

  test("every call gets a fresh client_id", () => {
    // The replay window keys on it. Reusing one would make the second call of a pair fail
    // with "already made", which reads like a bug in the server.
    const a = signRequest({ path: "/p", query: q(""), body: "", privateKeyPem: pem });
    const b = signRequest({ path: "/p", query: q(""), body: "", privateKeyPem: pem });
    expect(a.clientId).not.toBe(b.clientId);
  });
});
