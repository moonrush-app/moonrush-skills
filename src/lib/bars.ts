import { InvalidArgument } from "./validate.js";

/**
 * Chart candles, from the API's columnar shape to rows a reader (or a model) can use.
 *
 * The API answers `{ t: [...], o: [...], h: [...], l: [...], c: [...], volume: [...] }`,
 * one array per field, because that is what a charting library wants. A person asking
 * "what did it do today" wants one line per candle and the summary at the top.
 */

/** Friendly interval names to the API's resolutions, and the seconds each covers. */
export const INTERVALS: Record<string, { resolution: string; seconds: number }> = {
  "15s": { resolution: "15S", seconds: 15 },
  "30s": { resolution: "30S", seconds: 30 },
  "1m": { resolution: "1", seconds: 60 },
  "5m": { resolution: "5", seconds: 300 },
  "15m": { resolution: "15", seconds: 900 },
  "30m": { resolution: "30", seconds: 1_800 },
  "1h": { resolution: "60", seconds: 3_600 },
  "4h": { resolution: "240", seconds: 14_400 },
  "12h": { resolution: "720", seconds: 43_200 },
  "1d": { resolution: "1D", seconds: 86_400 },
  "1w": { resolution: "7D", seconds: 604_800 },
};

export function parseInterval(raw: unknown): { resolution: string; seconds: number } {
  const key = raw === undefined || raw === true ? "1h" : String(raw).toLowerCase();
  const found = INTERVALS[key];
  if (!found) {
    throw new InvalidArgument(`--interval is one of: ${Object.keys(INTERVALS).join(", ")}`);
  }
  return found;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Columnar {
  t?: number[];
  o?: (number | null)[];
  h?: (number | null)[];
  l?: (number | null)[];
  c?: (number | null)[];
  volume?: (string | number | null)[];
}

/** Rows, oldest first. Candles with no trade at all (null close) are dropped. */
export function toCandles(raw: Columnar): Candle[] {
  const t = raw.t ?? [];
  const out: Candle[] = [];
  for (let i = 0; i < t.length; i++) {
    const close = raw.c?.[i];
    if (close == null) continue;
    out.push({
      time: new Date(t[i]! * 1000).toISOString(),
      open: Number(raw.o?.[i] ?? close),
      high: Number(raw.h?.[i] ?? close),
      low: Number(raw.l?.[i] ?? close),
      close: Number(close),
      volume: Number(raw.volume?.[i] ?? 0),
    });
  }
  return out;
}

/** The numbers worth saying first: where it started, where it is, the range, the volume. */
export function summarize(candles: Candle[]) {
  if (candles.length === 0) return null;
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  const changePct = first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null;
  return {
    from: first.time,
    to: last.time,
    open: first.open,
    close: last.close,
    changePct: changePct == null ? null : Math.round(changePct * 100) / 100,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
    volume: Math.round(candles.reduce((s, c) => s + c.volume, 0) * 100) / 100,
    candles: candles.length,
  };
}

const pct = (v: number) => Math.round(v * 100) / 100;

/**
 * The measurements a pattern read rests on, computed rather than eyeballed: where price sits
 * in its range, the swing levels it has turned at, how volume moved, and what the last
 * candle looked like. The skill names patterns from these numbers; it does not get to invent
 * a level that is not in this list.
 */
export function analyze(candles: Candle[]) {
  if (candles.length < 10) return null;
  const last = candles[candles.length - 1]!;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));

  // A swing is a candle whose high (low) beats the two on each side.
  const swings: { kind: "high" | "low"; price: number; time: string }[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i]!;
    const around = [candles[i - 2]!, candles[i - 1]!, candles[i + 1]!, candles[i + 2]!];
    if (around.every((o) => c.high > o.high)) swings.push({ kind: "high", price: c.high, time: c.time });
    if (around.every((o) => c.low < o.low)) swings.push({ kind: "low", price: c.low, time: c.time });
  }
  const resistance = swings.filter((s) => s.kind === "high" && s.price > last.close).sort((a, b) => a.price - b.price);
  const support = swings.filter((s) => s.kind === "low" && s.price < last.close).sort((a, b) => b.price - a.price);

  // Trend from the halves, not from two points: one spike at either end would decide it.
  const mid = Math.floor(candles.length / 2);
  const mean = (cs: Candle[]) => cs.reduce((s, c) => s + c.close, 0) / cs.length;
  const firstHalf = mean(candles.slice(0, mid));
  const secondHalf = mean(candles.slice(mid));
  const halfChangePct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

  const quarter = Math.max(1, Math.floor(candles.length / 4));
  const vol = (cs: Candle[]) => cs.reduce((s, c) => s + c.volume, 0) / cs.length;
  const earlierVol = vol(candles.slice(0, candles.length - quarter));
  const recentVol = vol(candles.slice(-quarter));

  let streak = 0;
  const up = last.close >= last.open;
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i]!;
    if (c.close >= c.open !== up) break;
    streak++;
  }

  const ranges = candles.map((c) => (c.close > 0 ? (c.high - c.low) / c.close : 0));
  const range = last.high - last.low;
  const body = Math.abs(last.close - last.open);

  return {
    trend: halfChangePct > 5 ? "up" : halfChangePct < -5 ? "down" : "sideways",
    halfOverHalfPct: pct(halfChangePct),
    positionInRangePct: high > low ? pct(((last.close - low) / (high - low)) * 100) : null,
    belowHighPct: high > 0 ? pct(((high - last.close) / high) * 100) : null,
    aboveLowPct: low > 0 ? pct(((last.close - low) / low) * 100) : null,
    nearestResistance: resistance[0] ?? null,
    nearestSupport: support[0] ?? null,
    swingHighs: swings.filter((s) => s.kind === "high").map(({ price, time }) => ({ price, time })),
    swingLows: swings.filter((s) => s.kind === "low").map(({ price, time }) => ({ price, time })),
    recentVolumeVsEarlier: earlierVol > 0 ? pct(recentVol / earlierVol) : null,
    averageCandleRangePct: pct((ranges.reduce((s, r) => s + r, 0) / ranges.length) * 100),
    streak: { direction: up ? "green" : "red", candles: streak },
    lastCandle: {
      direction: up ? "green" : "red",
      bodyPctOfRange: range > 0 ? pct((body / range) * 100) : null,
      upperWickPctOfRange: range > 0 ? pct(((last.high - Math.max(last.open, last.close)) / range) * 100) : null,
      lowerWickPctOfRange: range > 0 ? pct(((Math.min(last.open, last.close) - last.low) / range) * 100) : null,
    },
  };
}
