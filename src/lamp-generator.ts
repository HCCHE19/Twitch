export type PaletteFamily = "amber" | "teal" | "rose";

export interface LampDesign {
  silhouette: 0 | 1 | 2 | 3 | 4;
  base: 0 | 1 | 2;
  glassPattern: 0 | 1 | 2 | 3;
  frame: 0 | 1 | 2;
  finial: 0 | 1 | 2;
  flame: 0 | 1 | 2;
  palette: PaletteFamily;
  hue: number;
  saturation: number;
  lightness: number;
  tilt: number;
  verticalOffset: number;
  motionPhase: number;
}

function xmur3(text: string): () => number {
  let hash = 1779033703 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLamp(userId: string): LampDesign {
  const random = mulberry32(xmur3(`lamplight:v2:${userId}`)());
  const roll = random();
  const palette: PaletteFamily = roll < 0.60 ? "amber" : roll < 0.85 ? "teal" : "rose";
  const [minHue, maxHue] = palette === "amber" ? [20, 50] : palette === "teal" ? [170, 195] : [335, 355];
  return {
    silhouette: Math.floor(random() * 5) as LampDesign["silhouette"],
    base: Math.floor(random() * 3) as LampDesign["base"],
    glassPattern: Math.floor(random() * 4) as LampDesign["glassPattern"],
    frame: Math.floor(random() * 3) as LampDesign["frame"],
    finial: Math.floor(random() * 3) as LampDesign["finial"],
    flame: Math.floor(random() * 3) as LampDesign["flame"],
    palette,
    hue: minHue + random() * (maxHue - minHue),
    saturation: 66 + random() * 18,
    lightness: 52 + random() * 14,
    tilt: -6 + random() * 12,
    verticalOffset: -12 + random() * 24,
    motionPhase: random() * Math.PI * 2
  };
}

export function discreteLampSignature(design: LampDesign): string {
  return [design.silhouette, design.base, design.glassPattern, design.frame, design.finial, design.flame].join(":");
}

export function renderedLampSignature(design: LampDesign): string {
  return [discreteLampSignature(design), design.palette, design.hue.toFixed(1), design.saturation.toFixed(1), design.lightness.toFixed(1), design.tilt.toFixed(1)].join(":");
}
