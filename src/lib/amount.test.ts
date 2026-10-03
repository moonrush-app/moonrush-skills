import { describe, expect, it } from "bun:test";
import { decimalToRaw, parseSlippageBps, percentToBps, rawToDecimal, shareOf } from "./amount.js";
import { parseNetworkId } from "./validate.js";

describe("decimalToRaw", () => {
  it("moves the point exactly, where a float would not", () => {
    expect(decimalToRaw("0.1", 6)).toBe("100000");
    expect(decimalToRaw("10", 6)).toBe("10000000");
    expect(decimalToRaw("1234.567891234567891234", 18)).toBe("1234567891234567891234");
  });
  it("refuses more precision than the token has, and zero", () => {
    expect(() => decimalToRaw("0.0000001", 6)).toThrow(/more decimal places/);
    expect(() => decimalToRaw("0", 6)).toThrow(/greater than zero/);
    expect(() => decimalToRaw("-1", 6)).toThrow(/positive number/);
    expect(() => decimalToRaw("1e3", 6)).toThrow(/positive number/);
  });
});

describe("rawToDecimal", () => {
  it("round-trips", () => {
    expect(rawToDecimal("1500000", 6)).toBe("1.5");
    expect(rawToDecimal("1", 6)).toBe("0.000001");
    expect(rawToDecimal("1000000", 6)).toBe("1");
    expect(rawToDecimal(decimalToRaw("42.000123", 9), 9)).toBe("42.000123");
  });
});

describe("percentages", () => {
  it("as basis points, and a share rounded down", () => {
    expect(percentToBps("50")).toBe(5000);
    expect(percentToBps("0.5")).toBe(50);
    expect(percentToBps("100")).toBe(10000);
    expect(() => percentToBps("0")).toThrow();
    expect(() => percentToBps("101")).toThrow();
    expect(shareOf("999", 5000)).toBe("499");
  });
  it("slippage in percent", () => {
    expect(parseSlippageBps("3")).toBe(300);
    expect(parseSlippageBps(undefined)).toBeUndefined();
    expect(() => parseSlippageBps("60")).toThrow(/at most 50/);
  });
});

describe("chain names", () => {
  it("are accepted wherever an id is", () => {
    expect(parseNetworkId("solana")).toBe(1399811149);
    expect(parseNetworkId("SOL")).toBe(1399811149);
    expect(parseNetworkId("robinhood")).toBe(4663);
    expect(parseNetworkId("rh")).toBe(4663);
    expect(parseNetworkId("base")).toBe(8453);
    expect(parseNetworkId("bsc")).toBe(56);
    expect(parseNetworkId("8453")).toBe(8453);
    expect(() => parseNetworkId("ethereum")).toThrow(/Known chains/);
  });
});
