import { describe, expect, test } from "bun:test";
import {
  InvalidArgument,
  base58ByteLength,
  isEvmAddress,
  isSolanaAddress,
  parseChoice,
  parseInteger,
  parseNetworkId,
  parseNetworkIdList,
  requireAddress,
  requireUuid,
  tokenId,
} from "./validate";

const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SYSTEM = "11111111111111111111111111111111";
const EVM = "0x4200000000000000000000000000000000000006";

const SOLANA = 1399811149;
const BASE = 8453;

describe("base58", () => {
  test("real Solana addresses decode to 32 bytes at 43 and at 44 characters", () => {
    expect(base58ByteLength(WSOL)).toBe(32);
    expect(base58ByteLength(USDC)).toBe(32);
  });

  test("leading 1s are zero bytes, so the all-zero address is still 32", () => {
    // The System Program. Every character carries no magnitude, so an implementation that
    // only did the arithmetic would call this 0 bytes and reject the most-used address on
    // the chain.
    expect(base58ByteLength(SYSTEM)).toBe(32);
    expect(isSolanaAddress(SYSTEM)).toBe(true);
  });

  test("44 base58 characters can be 33 bytes, which is why a length check is not enough", () => {
    // THE REASON THIS FILE DECODES. This string passes every plausible regex for a Solana
    // address: 44 characters, all in the alphabet, no 0/O/I/l. It is not an address.
    const thirtyThree = "z".repeat(44);
    expect(thirtyThree.length).toBe(44);
    expect(base58ByteLength(thirtyThree)).toBe(33);
    expect(isSolanaAddress(thirtyThree)).toBe(false);
  });

  test("characters base58 leaves out are rejected", () => {
    // 0, O, I and l are excluded precisely because they are misread, so a string carrying
    // one is far more likely a transcription error than an address.
    for (const ch of ["0", "O", "I", "l"]) {
      expect(base58ByteLength(WSOL.slice(0, -1) + ch)).toBeNull();
    }
  });
});

describe("addresses are checked against their chain", () => {
  test("a Solana address passes on Solana and an EVM one on Base", () => {
    expect(requireAddress(USDC, SOLANA)).toBe(USDC);
    expect(requireAddress(EVM, BASE)).toBe(EVM);
  });

  test("an EVM address on Solana names the actual mistake", () => {
    // Both shapes are valid addresses, so "invalid address" would be a lie and would send
    // the reader looking for a typo that is not there. The wrong thing is the chain.
    expect(() => requireAddress(EVM, SOLANA)).toThrow(InvalidArgument);
    try {
      requireAddress(EVM, SOLANA);
    } catch (e) {
      expect(String((e as Error).message)).toContain("EVM address");
      expect(String((e as Error).message)).toContain("--networkId");
    }
  });

  test("a Solana address on Base names the actual mistake", () => {
    try {
      requireAddress(USDC, BASE);
      throw new Error("should have thrown");
    } catch (e) {
      expect(String((e as Error).message)).toContain("Solana address");
    }
  });

  test("whitespace around a pasted address is trimmed, not rejected", () => {
    // Copying an address out of a terminal or a chat window brings a space with it often
    // enough that refusing one would be refusing a correct address.
    expect(requireAddress(`  ${USDC}\n`, SOLANA)).toBe(USDC);
  });

  test("a missing address is its own message, not a shape complaint", () => {
    expect(() => requireAddress(undefined, SOLANA)).toThrow("--address is required");
    expect(() => requireAddress(true, SOLANA)).toThrow("--address is required");
  });
});

describe("networkId", () => {
  test("a known chain passes and an unknown one lists the chains", () => {
    expect(parseNetworkId("8453")).toBe(8453);
    expect(parseNetworkId(undefined)).toBe(SOLANA);
    try {
      parseNetworkId("8543");
      throw new Error("should have thrown");
    } catch (e) {
      // An unknown id must NOT fall through. The API answers an empty board for a chain it
      // does not serve, and an empty board reads as a quiet market rather than a typo.
      expect(String((e as Error).message)).toContain("Soneium");
    }
  });

  test("a CSV list is validated per entry and handed back as a query string", () => {
    expect(parseNetworkIdList("1399811149, 8453")).toBe("1399811149,8453");
    expect(parseNetworkIdList(undefined)).toBeUndefined();
    expect(() => parseNetworkIdList("1399811149,9")).toThrow(InvalidArgument);
  });
});

describe("tokenId", () => {
  test("is address:networkId, the one shape /proxy/tokenDetails accepts", () => {
    // The API validates `{ tokenId: string }` and rejects a body carrying `address` and
    // `networkId` as separate fields. This CLI sent the separate fields until this commit,
    // so `token info` answered 400 for every address ever passed to it.
    expect(tokenId(USDC, SOLANA)).toBe(`${USDC}:${SOLANA}`);
    expect(tokenId(EVM, BASE)).toBe(`${EVM}:8453`);
  });
});

describe("numbers and choices", () => {
  test("a limit outside the API's range is refused here, with the range in the message", () => {
    expect(parseInteger(undefined, "limit", { min: 1, max: 50, fallback: 20 })).toBe(20);
    expect(parseInteger("50", "limit", { min: 1, max: 50, fallback: 20 })).toBe(50);
    expect(() =>
      parseInteger("100", "limit", { min: 1, max: 50, fallback: 20 }),
    ).toThrow("between 1 and 50");
    expect(() =>
      parseInteger("2.5", "limit", { min: 1, max: 50, fallback: 20 }),
    ).toThrow(InvalidArgument);
  });

  test("a bad choice prints the choices", () => {
    expect(parseChoice(undefined, "sortBy", ["a", "b"] as const, "a")).toBe("a");
    expect(() => parseChoice("c", "sortBy", ["a", "b"] as const, "a")).toThrow("a, b");
  });

  test("a user id must be a UUID", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(requireUuid(id, "userId")).toBe(id);
    expect(() => requireUuid("me", "userId")).toThrow(InvalidArgument);
  });
});
