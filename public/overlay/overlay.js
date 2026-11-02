import { drawLamp, generateLamp, historicalOpacity, lampScale } from "/shared/lamp.js";
import { rowLayout, selectVisibleLamps, separateAdjacentHues } from "/shared/layout.js";
import { closingFrame } from "/shared/closing.js";
import { flarePulse } from "/shared/flare.js";
import { openingCardFrame, returnGreeting } from "/shared/memory.js";
import { rollCallFrame } from "/shared/roll-call.js";
import { updateWaveTracker, waveIntensity } from "/shared/wave.js";

const canvas = document.querySelector("#lamps");
const context = canvas.getContext("2d");
const status = document.querySelector("#status");
const demo = document.querySelector("#demo");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let state = null;
let selectedLayout = "bottom";
let preferences = { compact: false, hidden: false, rollCall: false, rollCallCalled: [] };
let animationFrame = 0;
let thresholdN = 10;
let waveTracker = { streamId: null, fired: false, startedAt: null };
const previewBackground = new URLSearchParams(location.search).get("bg") === "1";

function resize() {
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function layout(items) {
  return rowLayout(items, Object.keys(state?.lamps ?? {}).length, innerWidth, innerHeight, selectedLayout, preferences.compact, (lamp) => generateLamp(lamp.userId).verticalOffset);
}

function render(time) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  if (previewBackground) {
    const backdrop = context.createLinearGradient(0, 0, innerWidth, innerHeight);
    backdrop.addColorStop(0, "#102536"); backdrop.addColorStop(.58, "#15202a"); backdrop.addColorStop(1, "#242326");
    context.fillStyle = backdrop; context.fillRect(0, 0, innerWidth, innerHeight);
  }
  canvas.style.opacity = preferences.hidden ? "0" : "1";
  const baseline = selectedLayout === "top" ? innerHeight * .12 : innerHeight * .88;
  const closing = closingFrame(state?.closingMoment, Date.now(), reducedMotion.matches);
  const opening = openingCardFrame(state?.openingCard, state?.currentStream, Date.now());
  const rollCall = rollCallFrame(preferences, state?.currentStream, Date.now());
  if (closing.kind !== "clear") {
    const sill = context.createLinearGradient(0, baseline - 20, 0, baseline + 20);
    sill.addColorStop(0, "rgba(255,190,110,0)"); sill.addColorStop(.48, "rgba(255,190,110,.08)"); sill.addColorStop(.58, "rgba(255,190,110,.055)"); sill.addColorStop(1, "rgba(255,190,110,0)");
    context.fillStyle = sill; context.fillRect(0, baseline - 20, innerWidth, 40);
  }
  if (state) {
    if (opening.active) {
      context.fillStyle = "rgba(246,232,207,.9)";
      context.font = `600 ${Math.max(18, innerHeight * .024)}px "Space Grotesk", system-ui, sans-serif`;
      context.textAlign = "center";
      context.fillText(opening.text, innerWidth / 2, baseline);
    }
    if (closing.kind === "summary") {
      context.fillStyle = "rgba(246,232,207,.9)";
      context.font = `600 ${Math.max(18, innerHeight * .024)}px "Space Grotesk", system-ui, sans-serif`;
      context.textAlign = "center";
      context.fillText(closing.text, innerWidth / 2, baseline);
    }
    const closingIds = state.closingMoment?.litUserIds ?? [];
    const visibleClosingIds = new Set(closing.kind === "lamps" ? closing.visibleUserIds : []);
    const lamps = opening.active ? [] : closing.kind === "lamps"
      ? closingIds.flatMap((userId) => state.lamps[userId] ? [state.lamps[userId]] : [])
      : closing.kind === "none" ? Object.values(state.lamps).sort((a, b) => b.lastLitAt.localeCompare(a.lastLitAt)) : [];
    const visible = separateAdjacentHues(
      selectVisibleLamps(lamps),
      (item) => generateLamp(item.lamp.userId).hue,
      ({ rowLength, collisions }) => console.warn(`[layout] ${collisions} unavoidable hue-distance violation(s) at row length ${rowLength}`)
    );
    const glowScale = Math.max(.32, Math.sqrt(6 / Math.max(6, visible.length)));
    const glowAlpha = Math.min(1, 6 / Math.max(6, visible.length));
    for (const [itemIndex, item] of layout(visible).entries()) {
      if (item.lamp) {
        if (closing.kind === "lamps" && !visibleClosingIds.has(item.lamp.userId)) continue;
        const bright = closing.kind === "lamps" || state.currentStream?.litUserIds.includes(item.lamp.userId);
        const opacity = (bright ? 1 : historicalOpacity(item.lamp.streamsSinceLit)) * opening.lampOpacity;
        const grownSize = item.size * lampScale(item.lamp.lifetimeLights);
        const baseRenderedSize = item.tier === 0 ? grownSize : Math.min(grownSize, item.collisionCap);
        const flare = flarePulse(state.flareAtByUserId?.[item.lamp.userId], Date.now(), reducedMotion.matches);
        const wave = reducedMotion.matches ? 0 : waveIntensity(waveTracker.startedAt, itemIndex, Date.now());
        const isRollCallCurrent = rollCall.active && rollCall.currentUserId === item.lamp.userId;
        const renderedSize = isRollCallCurrent ? baseRenderedSize * 1.25 : Math.min(baseRenderedSize * flare.scale * (1 + wave * .08), item.tier === 0 ? Number.POSITIVE_INFINITY : item.collisionCap);
        drawLamp(context, item.lamp.userId, item.x, item.y, renderedSize, opacity, reducedMotion.matches ? 0 : time, {
          detail: item.tier === 2 ? "essential" : "full", glowScale: glowScale * (1 + flare.intensity * .35 + wave * .25), glowAlpha
        });
        if (item.tier !== 0 && !isRollCallCurrent) continue;
        const labelSize = isRollCallCurrent ? Math.max(16, item.size * .16) : Math.max(12, item.size * .105);
        context.font = `600 ${labelSize}px "Space Grotesk", system-ui, sans-serif`;
        context.textAlign = "center";
        const labelY = item.y + item.size * .27;
        const labelWidth = context.measureText(item.lamp.displayName).width + labelSize * 1.5;
        context.fillStyle = `rgba(4, 9, 12, ${Math.max(.58, opacity * .74)})`;
        context.beginPath(); context.roundRect(item.x - labelWidth / 2, labelY - labelSize * .88, labelWidth, labelSize * 1.45, labelSize * .7); context.fill();
        context.strokeStyle = `rgba(237, 201, 133, ${Math.max(.16, opacity * .3)})`; context.lineWidth = 1; context.stroke();
        context.fillStyle = `rgba(246, 232, 207, ${Math.max(.52, opacity)})`;
        context.fillText(item.lamp.displayName, item.x, labelY);
        const greeting = returnGreeting(item.lamp, state.currentStream, Date.now());
        if (greeting) {
          context.fillStyle = "rgba(246,232,207,.72)";
          context.font = `500 ${Math.max(11, labelSize * .72)}px "Space Grotesk", system-ui, sans-serif`;
          context.fillText(greeting, item.x, labelY + labelSize * 1.35);
        }
      } else {
        drawLamp(context, "lamplight-cluster", item.x, item.y, Math.min(item.size * 1.08, item.collisionCap), .25, 0, { detail: "essential", glowScale, glowAlpha });
        context.fillStyle = "rgba(246,232,207,.72)"; context.font = `700 ${item.size * .16}px system-ui, sans-serif`; context.textAlign = "center";
        context.fillText(`+${item.cluster}`, item.x, item.y + item.size * .25);
      }
    }
  }
  if (!reducedMotion.matches) animationFrame = requestAnimationFrame(render);
}

function drawOnce() { cancelAnimationFrame(animationFrame); render(0); }
function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener("open", () => { status.textContent = "LIVE DATA"; status.hidden = true; });
  socket.addEventListener("message", (message) => {
    const packet = JSON.parse(message.data);
    if (packet.type === "state") {
      state = packet.state; selectedLayout = packet.layout === "top" ? "top" : "bottom";
      thresholdN = packet.thresholdN ?? 10;
      waveTracker = updateWaveTracker(waveTracker, state.currentStream?.id, state.currentStream?.litUserIds.length ?? 0, thresholdN);
      preferences = packet.preferences ?? preferences; demo.hidden = !state.demoReplay; drawOnce();
      if (reducedMotion.matches && state.closingMoment) setTimeout(drawOnce, 10_050);
      if (reducedMotion.matches && Object.values(state.flareAtByUserId ?? {}).some((value) => Date.now() - Date.parse(value) < 600)) setTimeout(drawOnce, 610);
    }
  });
  socket.addEventListener("close", () => { status.hidden = false; status.textContent = "RECONNECTING"; setTimeout(connect, 1000); });
}

addEventListener("resize", () => { resize(); drawOnce(); });
reducedMotion.addEventListener("change", drawOnce);
resize(); connect(); render(0);
