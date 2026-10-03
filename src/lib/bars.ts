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
