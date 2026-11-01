import { describe, expect, it } from "vitest";
import { generateLamp, renderedLampSignature } from "../src/lamp-generator.js";

describe("lamp generator", () => {
  it("is deterministic and varies across IDs", () => {
    expect(generateLamp("42")).toEqual(generateLamp("42"));
    expect(generateLamp("42")).not.toEqual(generateLamp("43"));
  });

  it("reaches five silhouettes and keeps hue continuous around the wheel", () => {
    const designs = Array.from({ length: 5_000 }, (_, index) => generateLamp(String(index)));
    expect(new Set(designs.map((design) => design.silhouette))).toEqual(new Set([0, 1, 2, 3, 4]));
    for (const design of designs) {
      expect(design.hue).toBeGreaterThanOrEqual(0);
      expect(design.hue).toBeLessThan(360);
    }
  });

  it("splits tone roughly evenly and uses all three flame colours across 1,000 ids", () => {
    const designs = Array.from({ length: 1_000 }, (_, index) => generateLamp(`tone-id-${index}`));
    const pastel = designs.filter((design) => design.tone === "pastel").length;
    expect(pastel / designs.length).toBeCloseTo(.5, 1);
    expect(new Set(designs.map((design) => design.flameColour))).toEqual(new Set(["gold", "white", "complement"]));
    for (const design of designs) {
      if (design.tone === "pastel") {
        expect(design.saturation).toBeGreaterThanOrEqual(45); expect(design.saturation).toBeLessThanOrEqual(55);
        expect(design.lightness).toBeGreaterThanOrEqual(68); expect(design.lightness).toBeLessThanOrEqual(75);
      } else {
        expect(design.saturation).toBeGreaterThanOrEqual(75); expect(design.saturation).toBeLessThanOrEqual(90);
        expect(design.lightness).toBeGreaterThanOrEqual(50); expect(design.lightness).toBeLessThanOrEqual(58);
      }
    }
  });

  it("keeps full rendered-signature collisions below two percent across 1,000 ids", () => {
    const signatures = Array.from({ length: 1_000 }, (_, index) => renderedLampSignature(generateLamp(`random-id-${index}`)));
    const counts = new Map<string, number>();
    for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);
    const colliding = signatures.filter((signature) => (counts.get(signature) ?? 0) > 1).length;
    expect(colliding / signatures.length).toBeLessThan(0.02);
  });

  it("covers at least four silhouettes and all flame colours across 200 ids", () => {
    const designs = Array.from({ length: 200 }, (_, index) => generateLamp(`coverage-id-${index}`));
    expect(new Set(designs.map((design) => design.silhouette)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(designs.map((design) => design.flameColour))).toEqual(new Set(["gold", "white", "complement"]));
  });

  it("matches the plain-JS generator reused by overlay and receipt", async () => {
    // @ts-expect-error The browser drawing module is intentionally framework-free JavaScript.
    const browser = await import("../public/shared/lamp.js") as { generateLamp: (id: string) => ReturnType<typeof generateLamp> };
    for (const id of ["42", "friend-a", "friend-b"]) expect(browser.generateLamp(id)).toEqual(generateLamp(id));
  });
});
