import { describe, expect, test } from "bun:test";
import { analyze, parseInterval, summarize, toCandles } from "./bars";

describe("chart candles", () => {
  // The live shape, from /proxy/getBars.
  const raw = {
    t: [1791021600, 1791025200, 1791028800],
    o: [0.00113838290979, 0.000894376247875, null],
    h: [0.00115507807807, 0.000911425839181, null],
    l: [0.000874041853382, 0.000572366529531, null],
    c: [0.000894376247875, 0.000660461625943, null],
    volume: ["110356.153593", "358921.433764", null],
  };

  test("columns become rows, and a candle with no trade is dropped", () => {
    const rows = toCandles(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      time: "2026-10-03T10:00:00.000Z",
      open: 0.00113838290979,
      high: 0.00115507807807,
      low: 0.000874041853382,
      close: 0.000894376247875,
      volume: 110356.153593,
    });
  });

  test("the summary measures from the first open to the last close", () => {
    const s = summarize(toCandles(raw))!;
    expect(s.changePct).toBe(-41.98);
    expect(s.high).toBe(0.00115507807807);
    expect(s.low).toBe(0.000572366529531);
    expect(s.volume).toBe(469277.59);
    expect(summarize([])).toBeNull();
  });

  test("intervals by name", () => {
    expect(parseInterval(undefined)).toEqual({ resolution: "60", seconds: 3600 });
    expect(parseInterval("4H").resolution).toBe("240");
    expect(parseInterval("1d").resolution).toBe("1D");
    expect(() => parseInterval("2h")).toThrow(/one of/);
  });
});

describe("chart analysis", () => {
  const c = (i: number, o: number, h: number, l: number, cl: number, v = 100) => ({
    time: new Date(1790000000000 + i * 3600_000).toISOString(),
    open: o,
    high: h,
    low: l,
    close: cl,
    volume: v,
  });

  test("too few candles is no analysis, not a guess", () => {
    expect(analyze([c(0, 1, 1, 1, 1)])).toBeNull();
  });

  test("finds the swing levels on each side of the close, the trend and the streak", () => {
    const rows = [
      c(0, 10, 11, 9, 10), c(1, 10, 12, 9, 11), c(2, 11, 20, 10, 15), c(3, 15, 16, 12, 13),
      c(4, 13, 14, 11, 12), c(5, 12, 13, 5, 8), c(6, 8, 10, 7, 9), c(7, 9, 12, 8, 11),
      c(8, 11, 14, 10, 13), c(9, 13, 15, 12, 14, 300), c(10, 14, 16, 13, 15, 300), c(11, 15, 16.5, 14, 16, 300),
    ];
    const a = analyze(rows)!;
    expect(a.nearestResistance?.price).toBe(20);
    expect(a.nearestSupport?.price).toBe(5);
    expect(a.streak).toEqual({ direction: "green", candles: 6 });
    expect(a.recentVolumeVsEarlier).toBe(3);
    expect(a.belowHighPct).toBe(20);
  });
});
