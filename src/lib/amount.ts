import { InvalidArgument } from "./validate.js";

/**
 * Human amounts to the integer units the API takes, and back, without a float in between.
 *
 * ⚠️ STRING ARITHMETIC ON PURPOSE. `0.1 * 10 ** 6` is 100000.00000000001 in a double, and a
 * token with 18 decimals passes 2^53 long before its balance is large. Moving the decimal
 * point in the string is exact for every amount, which is the only acceptable error rate
 * for a number that is about to be spent.
 */

/** A positive decimal like "12.5", as typed. */
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** "1.5" with 6 decimals is "1500000". Refuses more precision than the token has. */
export function decimalToRaw(value: string, decimals: number, name = "amount"): string {
  const m = DECIMAL.exec(value.trim());
  if (!m) throw new InvalidArgument(`--${name} must be a positive number, got: ${value}`);
  const whole = m[1]!;
  const frac = m[2] ?? "";
  if (frac.length > decimals) {
    throw new InvalidArgument(
      `--${name} has more decimal places than the token (${decimals}): ${value}`,
    );
  }
  const raw = BigInt(whole + frac.padEnd(decimals, "0"));
  if (raw <= 0n) throw new InvalidArgument(`--${name} must be greater than zero`);
  return raw.toString();
}

/** "1500000" with 6 decimals is "1.5". Trailing zeros trimmed. */
export function rawToDecimal(raw: string | bigint, decimals: number): string {
  const s = BigInt(raw).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return s;
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** A percentage 0 < p <= 100, as basis points: "50" is 5000, "0.5" is 50. */
export function percentToBps(value: unknown, name = "percent"): number {
  const n = Number(value);
  if (typeof value !== "string" || !Number.isFinite(n) || n <= 0 || n > 100) {
    throw new InvalidArgument(`--${name} must be a number above 0 and at most 100, got: ${String(value)}`);
  }
  const bps = Math.round(n * 100);
  if (bps < 1) throw new InvalidArgument(`--${name} is below 0.01%`);
  return bps;
}

/** `raw * bps / 10000`, rounded down, so a share never asks for more than is held. */
export function shareOf(raw: string | bigint, bps: number): string {
  return ((BigInt(raw) * BigInt(bps)) / 10_000n).toString();
}

/**
 * Slippage as a percentage ("3" is 300 bps), within what the API accepts.
 *
 * Capped at 50%: the order endpoint refuses more, and above that "slippage" stops being a
 * tolerance and becomes a donation.
 */
export function parseSlippageBps(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (typeof value !== "string" || !Number.isFinite(n) || n <= 0 || n > 50) {
    throw new InvalidArgument(`--slippage is a percentage above 0 and at most 50, got: ${String(value)}`);
  }
  return Math.max(1, Math.round(n * 100));
}

/** USDC has six decimals on every chain this trades. */
export const USDC_DECIMALS = 6;
