import { describe, expect, test } from "bun:test";
import { parseInterval, summarize, toCandles } from "./bars";

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
