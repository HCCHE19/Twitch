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
  const random = mulberry32(xmur3(`lamplight:v2:${userId}`)());
  const hue = random() * 360;
  const tone = random() < .5 ? "pastel" : "deep";
  const flameColour = ["gold", "white", "complement"][Math.floor(random() * 3)];
  return {
    silhouette: Math.floor(random() * 5), base: Math.floor(random() * 3), glassPattern: Math.floor(random() * 4),
    frame: Math.floor(random() * 3), finial: Math.floor(random() * 3), flame: Math.floor(random() * 3), tone, flameColour,
    hue, saturation: tone === "pastel" ? 45 + random() * 10 : 75 + random() * 15, lightness: tone === "pastel" ? 68 + random() * 7 : 50 + random() * 8,
    tilt: -6 + random() * 12, verticalOffset: -12 + random() * 24, motionPhase: random() * Math.PI * 2
  };
}

function bodyPath(context, lamp, size) {
  const width = size * .25;
  context.beginPath();
  if (lamp.silhouette === 0) {
    context.moveTo(0, -size * .82); context.bezierCurveTo(-width * .95, -size * .62, -width, -size * .28, -width * .82, -size * .10);
    context.lineTo(width * .82, -size * .10); context.bezierCurveTo(width, -size * .28, width * .95, -size * .62, 0, -size * .82);
  } else if (lamp.silhouette === 1) {
    context.moveTo(-width * .65, -size * .76); context.lineTo(width * .65, -size * .76); context.lineTo(width, -size * .60);
    context.lineTo(width, -size * .15); context.lineTo(width * .72, -size * .08); context.lineTo(-width * .72, -size * .08);
    context.lineTo(-width, -size * .15); context.lineTo(-width, -size * .60);
  } else if (lamp.silhouette === 2) {
    context.moveTo(-width * .42, -size * .78); context.quadraticCurveTo(-width * .9, -size * .60, -width * 1.12, -size * .12);
    context.lineTo(width * 1.12, -size * .12); context.quadraticCurveTo(width * .9, -size * .60, width * .42, -size * .78);
  } else if (lamp.silhouette === 3) {
    context.moveTo(-width, -size * .10); context.lineTo(-width, -size * .61); context.quadraticCurveTo(-width, -size * .78, -width * .55, -size * .78);
    context.lineTo(width * .55, -size * .78); context.quadraticCurveTo(width, -size * .78, width, -size * .61); context.lineTo(width, -size * .10);
  } else {
    context.arc(0, -size * .43, size * .31, 0, Math.PI * 2);
  }
  context.closePath();
}

function drawPattern(context, lamp, size, color) {
  if (lamp.glassPattern === 0) return;
  context.save(); bodyPath(context, lamp, size); context.clip();
  context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(1, size * .009);
  if (lamp.glassPattern === 1) {
    for (let x = -size * .22; x <= size * .22; x += size * .09) { context.beginPath(); context.moveTo(x, -size * .78); context.lineTo(x, -size * .08); context.stroke(); }
  } else if (lamp.glassPattern === 2) {
    for (let y = -size * .70; y <= -size * .14; y += size * .12) for (let x = -size * .18; x <= size * .18; x += size * .12) {
      context.beginPath(); context.arc(x + ((Math.round(y / (size * .12)) % 2) * size * .04), y, Math.max(1, size * .012), 0, Math.PI * 2); context.fill();
    }
  } else {
    for (let offset = -size; offset <= size; offset += size * .13) {
      context.beginPath(); context.moveTo(-size * .42, offset); context.lineTo(size * .42, offset - size * .84); context.stroke();
      context.beginPath(); context.moveTo(-size * .42, offset - size * .84); context.lineTo(size * .42, offset); context.stroke();
    }
  }
  context.restore();
}

export function drawLampDesign(context, lamp, x, y, size, brightness, time = 0, options = {}) {
  const essential = options.detail === "essential";
  const glowScale = options.glowScale ?? 1;
  const glowAlpha = options.glowAlpha ?? 1;
  const displaySaturation = brightness < 1 ? lamp.saturation * .20 : lamp.saturation;
  const flameHue = lamp.flameColour === "gold" ? 42 : lamp.flameColour === "white" ? 45 : (lamp.hue + 180) % 360;
  const flameSaturation = lamp.flameColour === "gold" ? 90 : lamp.flameColour === "white" ? 20 : 30;
  const flameLightness = lamp.flameColour === "gold" ? 67 : lamp.flameColour === "white" ? 94 : 70;
  const flameColor = `hsl(${flameHue}, ${brightness < 1 ? flameSaturation * .20 : flameSaturation}%, ${flameLightness}%)`;
  const flicker = Math.sin(time * .0022 + lamp.motionPhase) * size * .012 * brightness;
  context.save(); context.translate(x, y); context.globalAlpha = Math.max(.18, brightness); context.scale(1, options.scaleY ?? 1);

  const separation = context.createRadialGradient(0, -size * .42, size * .08, 0, -size * .42, size * 1.25 * glowScale);
  separation.addColorStop(0, "rgba(2,6,8,.52)"); separation.addColorStop(.58, "rgba(2,6,8,.25)"); separation.addColorStop(1, "rgba(2,6,8,0)");
  context.fillStyle = separation; context.beginPath(); context.arc(0, -size * .42, size * 1.25 * glowScale, 0, Math.PI * 2); context.fill();
  const halo = context.createRadialGradient(0, -size * .43, size * .03, 0, -size * .43, size * 2.5 * glowScale);
  const haloSaturation = brightness < 1 ? 20 : 92;
  halo.addColorStop(0, `hsla(38,${haloSaturation}%,67%,${(.18 + brightness * .34) * glowAlpha})`); halo.addColorStop(.18, `hsla(35,${haloSaturation * .91}%,60%,${(.10 + brightness * .18) * glowAlpha})`);
  halo.addColorStop(.48, `hsla(30,${haloSaturation * .80}%,54%,${(.025 + brightness * .055) * glowAlpha})`); halo.addColorStop(1, "rgba(24,12,4,0)");
  context.fillStyle = halo; context.beginPath(); context.arc(0, -size * .43, size * 2.5 * glowScale, 0, Math.PI * 2); context.fill();

  context.rotate(((essential ? 0 : lamp.tilt) + (options.extraTilt ?? 0)) * Math.PI / 180);
  if (lamp.base === 0) {
    context.fillStyle = "rgba(72,42,22,.98)"; context.beginPath(); context.roundRect(-size * .27, -size * .12, size * .54, size * .18, size * .025); context.fill();
    context.strokeStyle = "rgba(218,151,84,.62)"; context.lineWidth = Math.max(1, size * .012); context.stroke();
  } else if (lamp.base === 1) {
    context.strokeStyle = "rgba(62,76,78,.98)"; context.lineWidth = size * .055; context.beginPath(); context.ellipse(0, -size * .08, size * .29, size * .10, 0, 0, Math.PI * 2); context.stroke();
  } else {
    context.strokeStyle = "rgba(68,80,81,.98)"; context.lineWidth = Math.max(2, size * .025); context.beginPath(); context.moveTo(0, -size * .98); context.lineTo(0, -size * .78); context.arc(size * .035, -size * .75, size * .04, Math.PI, 0); context.stroke();
  }

  bodyPath(context, lamp, size);
  context.fillStyle = `hsla(${lamp.hue},${displaySaturation}%,72%,${.32 + brightness * .18})`; context.fill();
  bodyPath(context, lamp, size); context.strokeStyle = `hsla(${lamp.hue},${Math.min(52, displaySaturation)}%,74%,${.50 + brightness * .25})`;
  context.lineWidth = Math.max(1.3, size * .012); context.lineJoin = "round"; context.stroke();
  if (!essential && lamp.frame > 0) {
    bodyPath(context, lamp, size); context.strokeStyle = `hsla(${lamp.hue},${Math.min(48, displaySaturation)}%,70%,${.42 + brightness * .34})`;
    context.lineWidth = lamp.frame === 1 ? Math.max(1.4, size * .014) : Math.max(3, size * .034); context.lineJoin = lamp.frame === 2 ? "bevel" : "round"; context.stroke();
    if (lamp.frame === 2) { context.fillStyle = "rgba(5,12,14,.86)"; for (const [cx, cy] of [[-.21,-.15],[.21,-.15],[-.16,-.68],[.16,-.68]]) context.fillRect(cx * size - size * .018, cy * size - size * .018, size * .036, size * .036); }
  }
  drawPattern(context, lamp, size, `hsla(${lamp.hue},${Math.min(58, displaySaturation)}%,76%,${.40 + brightness * .20})`);

  if (!essential && lamp.finial === 1) {
    context.strokeStyle = "rgba(8,15,17,.94)"; context.lineWidth = size * .025; context.beginPath(); context.arc(0, -size * .84, size * .075, 0, Math.PI * 2); context.stroke();
  } else if (!essential && lamp.finial === 2) {
    context.fillStyle = "rgba(8,15,17,.94)"; context.beginPath(); context.roundRect(-size * .09, -size * .86, size * .18, size * .075, size * .025); context.fill();
  }

  context.fillStyle = flameColor; context.shadowColor = flameColor; context.shadowBlur = size * (.07 + brightness * .13);
  if (options.flameLean) {
    context.translate(0, -size * .22); context.transform(1, 0, options.flameLean, 1, 0, 0); context.translate(0, size * .22);
  }
  context.beginPath();
  if (lamp.flame === 0) {
    context.moveTo(0, -size * .25); context.bezierCurveTo(-size * .085, -size * .34, -size * .04, -size * .47, 0, -size * .52 + flicker); context.bezierCurveTo(size * .08, -size * .42, size * .08, -size * .32, 0, -size * .25);
  } else if (lamp.flame === 1) {
    context.moveTo(0, -size * .22); context.bezierCurveTo(-size * .11, -size * .36, -size * .03, -size * .58, size * .035, -size * .69 + flicker); context.bezierCurveTo(size * .13, -size * .49, size * .10, -size * .31, 0, -size * .22);
  } else {
    context.moveTo(0, -size * .22); context.bezierCurveTo(-size * .13, -size * .35, -size * .11, -size * .52, -size * .045, -size * .63 + flicker); context.quadraticCurveTo(0, -size * .52, size * .025, -size * .43); context.quadraticCurveTo(size * .07, -size * .58, size * .12, -size * .61 - flicker); context.bezierCurveTo(size * .15, -size * .42, size * .11, -size * .28, 0, -size * .22);
  }
  context.fill(); context.restore();
}

export function drawLamp(context, userId, x, y, size, brightness, time = 0, options = {}) {
  drawLampDesign(context, generateLamp(userId), x, y, size, brightness, time, options);
}

export function historicalOpacity(distance) { return distance <= 0 ? 1 : distance === 1 ? .45 : distance === 2 ? .30 : .20; }
export function lampScale(lifetimeLights) { return Math.min(1.32, 1 + Math.max(0, lifetimeLights - 1) * .025); }
