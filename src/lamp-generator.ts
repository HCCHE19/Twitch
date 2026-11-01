export type PaletteFamily = "amber" | "teal" | "rose";

export interface LampDesign {
  silhouette: 0 | 1 | 2 | 3 | 4;
  palette: PaletteFamily;
  hue: number;
  saturation: number;
  lightness: number;
  glassTaper: number;
  baseWidth: number;
  flameLean: number;
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
  const random = mulberry32(xmur3(`lamplight:v1:${userId}`)());
  const roll = random();
  const palette: PaletteFamily = roll < 0.60 ? "amber" : roll < 0.85 ? "teal" : "rose";
  const [minHue, maxHue] = palette === "amber" ? [20, 50] : palette === "teal" ? [170, 195] : [335, 355];
  return {
    silhouette: Math.floor(random() * 5) as LampDesign["silhouette"],
    palette,
    hue: minHue + random() * (maxHue - minHue),
    saturation: 66 + random() * 18,
    lightness: 52 + random() * 14,
    glassTaper: 0.72 + random() * 0.20,
    baseWidth: 0.78 + random() * 0.30,
    flameLean: -0.16 + random() * 0.32,
    motionPhase: random() * Math.PI * 2
  };
}
