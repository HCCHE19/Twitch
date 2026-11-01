import { describe, expect, it } from "vitest";
import { generateLamp } from "../src/lamp-generator.js";

describe("lamp generator", () => {
  it("is deterministic and varies across IDs", () => {
    expect(generateLamp("42")).toEqual(generateLamp("42"));
    expect(generateLamp("42")).not.toEqual(generateLamp("43"));
  });

  it("reaches five silhouettes and keeps hue inside each palette", () => {
    const designs = Array.from({ length: 5_000 }, (_, index) => generateLamp(String(index)));
    expect(new Set(designs.map((design) => design.silhouette))).toEqual(new Set([0, 1, 2, 3, 4]));
    for (const design of designs) {
      const range = design.palette === "amber" ? [20, 50] : design.palette === "teal" ? [170, 195] : [335, 355];
      expect(design.hue).toBeGreaterThanOrEqual(range[0] as number);
      expect(design.hue).toBeLessThanOrEqual(range[1] as number);
    }
  });

  it("approximates the 60/25/15 palette mix", () => {
    const counts = { amber: 0, teal: 0, rose: 0 };
    for (let index = 0; index < 10_000; index += 1) counts[generateLamp(String(index)).palette] += 1;
    expect(counts.amber / 10_000).toBeCloseTo(0.60, 1);
    expect(counts.teal / 10_000).toBeCloseTo(0.25, 1);
    expect(counts.rose / 10_000).toBeCloseTo(0.15, 1);
  });
});
