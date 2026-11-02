import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { fitNamePlate, LABEL_FONT_FALLBACK } from "../public/shared/labels.js";

describe("Unicode name plates", () => {
  it.each(["ひうちん張", "張曉晴", "山田太郎配信中"])("fits %s inside a bounded plate with CJK system fallbacks", (name) => {
    const simulatedMeasuredWidth = [...name].length * 19;
    const fit = fitNamePlate(simulatedMeasuredWidth, 18, 120);
    expect(fit.textWidth).toBeLessThanOrEqual(120);
    expect(fit.plateWidth).toBeLessThanOrEqual(120 + fit.fontSize * 1.5);
    expect(fit.fontSize).toBeGreaterThanOrEqual(9);
    expect(LABEL_FONT_FALLBACK).toContain("Hiragino Sans");
    expect(LABEL_FONT_FALLBACK).toContain("PingFang SC");
  });
});
