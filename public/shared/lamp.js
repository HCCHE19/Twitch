function xmur3(text) {
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

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLamp(userId) {
  const random = mulberry32(xmur3(`lamplight:v1:${userId}`)());
  const roll = random();
  const palette = roll < 0.60 ? "amber" : roll < 0.85 ? "teal" : "rose";
  const [minHue, maxHue] = palette === "amber" ? [20, 50] : palette === "teal" ? [170, 195] : [335, 355];
  return {
    silhouette: Math.floor(random() * 5), palette, hue: minHue + random() * (maxHue - minHue),
    saturation: 66 + random() * 18, lightness: 52 + random() * 14,
    glassTaper: 0.72 + random() * 0.20, baseWidth: 0.78 + random() * 0.30,
    flameLean: -0.16 + random() * 0.32, motionPhase: random() * Math.PI * 2
  };
}

export function drawLamp(context, userId, x, y, size, brightness, time = 0) {
  const lamp = generateLamp(userId);
  const glow = `hsla(${lamp.hue}, ${lamp.saturation}%, ${lamp.lightness}%, ${0.12 + brightness * 0.34})`;
  const color = `hsl(${lamp.hue}, ${lamp.saturation}%, ${lamp.lightness}%)`;
  const dark = "rgba(4, 9, 12, .88)";
  const flicker = Math.sin(time * 0.0022 + lamp.motionPhase) * size * 0.012 * brightness;
  context.save();
  context.translate(x, y);
  context.globalAlpha = Math.max(0.18, brightness);

  const ground = context.createRadialGradient(0, size * 0.12, 0, 0, size * 0.12, size * 0.48);
  ground.addColorStop(0, `hsla(${lamp.hue}, ${lamp.saturation}%, ${lamp.lightness}%, ${0.10 + brightness * 0.16})`);
  ground.addColorStop(0.55, "rgba(3, 8, 11, .24)");
  ground.addColorStop(1, "rgba(3, 8, 11, 0)");
  context.save(); context.scale(1, .24); context.fillStyle = ground;
  context.beginPath(); context.arc(0, size * .5, size * .48, 0, Math.PI * 2); context.fill(); context.restore();

  const halo = context.createRadialGradient(0, -size * 0.42, size * 0.05, 0, -size * 0.42, size * 0.72);
  halo.addColorStop(0, glow);
  halo.addColorStop(0.55, "rgba(3, 8, 11, .34)");
  halo.addColorStop(1, "rgba(3, 8, 11, 0)");
  context.fillStyle = halo;
  context.beginPath(); context.arc(0, -size * 0.38, size * 0.74, 0, Math.PI * 2); context.fill();

  context.fillStyle = dark;
  const baseWidth = size * 0.42 * lamp.baseWidth;
  context.beginPath();
  if (lamp.silhouette === 0) context.roundRect(-baseWidth, -size * 0.16, baseWidth * 2, size * 0.28, size * 0.06);
  else if (lamp.silhouette === 1) { context.moveTo(-baseWidth, size * 0.11); context.lineTo(-baseWidth * 0.78, -size * 0.17); context.lineTo(baseWidth * 0.78, -size * 0.17); context.lineTo(baseWidth, size * 0.11); }
  else if (lamp.silhouette === 2) context.ellipse(0, -size * 0.02, baseWidth, size * 0.18, 0, 0, Math.PI * 2);
  else if (lamp.silhouette === 3) { context.roundRect(-baseWidth, -size * 0.13, baseWidth * 2, size * 0.24, size * 0.12); context.rect(-baseWidth * 0.16, -size * 0.31, baseWidth * 0.32, size * 0.20); }
  else { context.moveTo(-baseWidth, size * 0.11); context.quadraticCurveTo(-baseWidth * 1.08, -size * 0.12, -baseWidth * 0.55, -size * 0.2); context.lineTo(baseWidth * 0.55, -size * 0.2); context.quadraticCurveTo(baseWidth * 1.08, -size * 0.12, baseWidth, size * 0.11); }
  context.closePath(); context.fill();

  const glassWidth = size * 0.25 * lamp.glassTaper;
  const glassTop = -size * 0.72;
  context.fillStyle = `hsla(${lamp.hue}, 72%, 72%, ${0.08 + brightness * 0.17})`;
  context.strokeStyle = `hsla(${lamp.hue}, 55%, 68%, ${0.28 + brightness * 0.32})`;
  context.lineWidth = Math.max(1.2, size * 0.018);
  context.beginPath();
  context.moveTo(-glassWidth, -size * 0.18); context.quadraticCurveTo(-glassWidth * 1.18, -size * 0.48, -glassWidth * 0.62, glassTop);
  context.lineTo(glassWidth * 0.62, glassTop); context.quadraticCurveTo(glassWidth * 1.18, -size * 0.48, glassWidth, -size * 0.18);
  context.closePath(); context.fill(); context.stroke();

  context.fillStyle = color;
  context.shadowColor = color; context.shadowBlur = size * (0.08 + brightness * 0.16);
  context.beginPath();
  context.moveTo(0, -size * 0.25);
  context.bezierCurveTo(-size * 0.12, -size * 0.38, -size * 0.03, -size * 0.55 + flicker, size * lamp.flameLean, -size * 0.61 + flicker);
  context.bezierCurveTo(size * 0.14, -size * 0.48, size * 0.12, -size * 0.34, 0, -size * 0.25);
  context.fill();
  context.restore();
}

export function historicalOpacity(distance) {
  return distance <= 0 ? 1 : distance === 1 ? 0.45 : distance === 2 ? 0.30 : 0.18;
}

export function lampScale(lifetimeLights) {
  return Math.min(1.32, 1 + Math.max(0, lifetimeLights - 1) * 0.025);
}
