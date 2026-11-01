import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay layout is intentionally plain browser JavaScript.
import { densityTier, hueDistance, rowLayout, selectVisibleLamps, separateAdjacentHues } from "../public/shared/layout.js";
import { generateLamp } from "../src/lamp-generator.js";

const lamps = (count: number) => Array.from({ length: count }, (_, index) => ({ userId: String(index) }));

describe("single-band overlay layout", () => {
  it("places full-size lamps from x=80 at exactly 150px spacing on an 88% baseline", () => {
    const items = lamps(5).map((lamp) => ({ lamp }));
    const result = rowLayout(items, 5, 1920, 1080, "bottom", false, (lamp: { userId: string }) => Number(lamp.userId) - 2);
    expect(result.map((item: { x: number }) => item.x)).toEqual([80, 230, 380, 530, 680]);
    expect(result.map((item: { y: number }) => item.y)).toEqual([948.4, 949.4, 950.4, 951.4, 952.4]);
    expect(result.every((item: { size: number; tier: number }) => item.size === 176 && item.tier === 0)).toBe(true);
  });

  it("uses the agreed density tiers and compact drops one tier", () => {
    expect([5, 30, 60].map((count) => densityTier(count))).toEqual([0, 1, 2]);
    expect([5, 30, 60].map((count) => densityTier(count, true))).toEqual([1, 2, 2]);
  });

  it("clamps the 30-lamp tier so glass footprints cannot overlap", () => {
    const items = lamps(30).map((lamp) => ({ lamp }));
    const row = rowLayout(items, 30, 1920, 1080, "bottom");
    const spacing = row[1].x - row[0].x;
    expect(row[0].size).toBeCloseTo(spacing / .74);
    expect(row[0].size * .72).toBeLessThanOrEqual(spacing);
    expect(row.at(-1).x).toBeLessThanOrEqual(1840);
  });

  it("caps 200 people at 60 lamps plus one +140 cluster", () => {
    const selected = selectVisibleLamps(lamps(200));
    expect(selected).toHaveLength(61);
    expect(selected.at(-1)).toEqual({ cluster: 140 });
    const row = rowLayout(selected, 200, 1920, 1080, "bottom");
    expect(row.every((item: { y: number }) => item.y === 950.4)).toBe(true);
  });

  it("keeps adjacent hues at least 45 degrees apart across 500 random 30-lamp rows", () => {
    for (let rowIndex = 0; rowIndex < 500; rowIndex += 1) {
      const items = Array.from({ length: 30 }, (_, index) => ({ lamp: { userId: `random-row-${rowIndex}-${index}` } }));
      let impossible = false;
      const arranged = separateAdjacentHues(items, (item: { lamp: { userId: string } }) => generateLamp(item.lamp.userId).hue, () => { impossible = true; });
      const hues = arranged.map((item: { lamp: { userId: string } }) => generateLamp(item.lamp.userId).hue);
      const violations = hues.slice(1).filter((hue: number, index: number) => hueDistance(hue, hues[index]) < 45).length;
      if (!impossible) expect(violations, `row ${rowIndex}`).toBe(0);
    }
  });
});
