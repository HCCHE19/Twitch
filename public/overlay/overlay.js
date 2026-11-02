import { skyProgressFrame } from "/shared/sky-progress.js";
import { drawLamp, generateLamp, historicalOpacity, lampScale } from "/shared/lamp.js";
import { rowLayout, selectVisibleLamps } from "/shared/layout.js";
import { closingFrame } from "/shared/closing.js";
import { flarePulse } from "/shared/flare.js";
import { openingCardFrame, returnGreeting } from "/shared/memory.js";
import { rollCallFrame } from "/shared/roll-call.js";
import { updateWaveTracker, waveIntensity } from "/shared/wave.js";
import { fitNamePlate, LABEL_FONT_FALLBACK } from "/shared/labels.js";
import { neighbourWelcome } from "/shared/neighbours.js";
import { flareInteractions } from "/shared/flare-interactions.js";
import { drawThreadLines, placeThreadArrival, threadVisuals } from "/shared/threads.js";
import { drawSkyGlyph, drawSkyOverlay, skyPanelTransitionAt, updateSkyDisplayLock } from "/shared/sky.js";
import { updateWindTracker, windLean } from "/shared/wind.js";
import { completionMomentFrame, fragmentBandMoment, fragmentMomentFrame, igniteFrame } from "/shared/moments.js";
import { animateRowLayout, reconcileLampOrder, releaseArrivalBatch } from "/shared/row-motion.js";
import { closingHintPosition, closingHintVisible, keptPromisePulse, promiseKnotFrame } from "/shared/promises.js";

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
let showNames = true;
let threadsEnabled = false;
let skyEnabled = false;
let windEnabled = false;
let momentLevel = "normal";
let promisesEnabled = true;
let windTracker = { streamId: null, startedAt: null, lastTriggeredAt: null, signature: "", direction: 1 };
let waveTracker = { streamId: null, fired: false, startedAt: null };
let stableOrderIds = [];
let layoutMotion = new Map();
const queuedArrivals = new Map();
let arrivalBatchStartedAt = null;
const arrivalStarts = new Map();
let lastThreadSlideAt = null;
let skyDisplayLock = null;
let skyProgressTracker = null;
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

function bandClip() {
  context.beginPath();
  if (selectedLayout === "top") context.rect(0, 0, innerWidth, innerHeight * .25);
  else context.rect(0, innerHeight * .72, innerWidth, innerHeight * .28);
  context.clip();
}

function drawBandSweep(frame, baseline) {
  if (!frame.active || frame.sweep <= 0 || reducedMotion.matches) return;
  const x = frame.sweep * innerWidth, width = Math.max(120, innerWidth * .10);
  context.save(); bandClip();
  const sweep = context.createLinearGradient(x - width, 0, x + width, 0);
  sweep.addColorStop(0, "rgba(246,232,207,0)"); sweep.addColorStop(.5, "rgba(246,232,207,.13)"); sweep.addColorStop(1, "rgba(246,232,207,0)");
  context.fillStyle = sweep; context.fillRect(x - width, baseline - 28, width * 2, 56); context.restore();
}

function drawCompletionMoment(fragment, frame, baseline) {
  if (!fragment || !frame.active || frame.maxHeight <= 0) return;
  const fullHeight = innerHeight * frame.maxHeight, fullWidth = Math.min(innerWidth * .64, fullHeight * 2.4);
  const startX = (innerWidth - fullWidth) / 2, startY = selectedLayout === "top" ? 0 : baseline - fullHeight;
  const panelX = innerWidth - 420, panelY = 28, targetW = 210, targetH = 112, ease = frame.shrink * frame.shrink * (3 - 2 * frame.shrink);
  const lerp = (from, to) => from + (to - from) * ease;
  context.save(); context.globalAlpha = frame.travelAlpha ?? 1;
  drawSkyGlyph(context, fragment.constellation, ["A", "B", "C", "D", "E", "F"], lerp(startX, panelX), lerp(startY, panelY), lerp(fullWidth, targetW), lerp(fullHeight, targetH), { large: true, background: false, revealProgress: frame.reveal });
  if (frame.flare > 0) {
    const glow = context.createLinearGradient(0, baseline - 30, 0, baseline + 30);
    glow.addColorStop(0, "rgba(246,232,207,0)"); glow.addColorStop(.5, `rgba(246,232,207,${frame.flare * .18})`); glow.addColorStop(1, "rgba(246,232,207,0)");
    context.fillStyle = glow; context.fillRect(0, baseline - 30, innerWidth, 60);
  }
  context.restore();
}

function render(time) {
  const renderNow = Date.now();
  context.clearRect(0, 0, innerWidth, innerHeight);
  if (previewBackground) {
    const backdrop = context.createLinearGradient(0, 0, innerWidth, innerHeight);
    backdrop.addColorStop(0, "#102536"); backdrop.addColorStop(.58, "#15202a"); backdrop.addColorStop(1, "#242326");
    context.fillStyle = backdrop; context.fillRect(0, 0, innerWidth, innerHeight);
  }
  canvas.style.opacity = preferences.hidden ? "0" : "1";
  const baseline = selectedLayout === "top" ? innerHeight * .12 : innerHeight * .88;
  const closingThreadCount = threadsEnabled ? (state?.threads ?? []).filter(thread => thread.userIds.every(id => state?.closingMoment?.litUserIds.includes(id))).length : 0;
  const closing = closingFrame(state?.closingMoment, renderNow, reducedMotion.matches, closingThreadCount);
  const opening = openingCardFrame(state?.openingCard, state?.currentStream, promisesEnabled ? state?.promiseKeptUserIds : [], threadsEnabled ? state?.threads : [], renderNow);

  windTracker = updateWindTracker(windTracker, state?.currentStream?.id, state?.flareAtByUserId ?? {}, renderNow, windEnabled);
  const sharedWindLean = reducedMotion.matches ? 0 : windLean(windTracker, renderNow);
  waveTracker = updateWaveTracker(waveTracker, state?.currentStream?.id, opening.active ? 0 : state?.currentStream?.litUserIds.length ?? 0, thresholdN);
  const rollCall = rollCallFrame(preferences, state?.currentStream, Date.now());
  if (closing.kind !== "clear") {
    const sill = context.createLinearGradient(0, baseline - 20, 0, baseline + 20);
    sill.addColorStop(0, "rgba(255,190,110,0)"); sill.addColorStop(.48, "rgba(255,190,110,.08)"); sill.addColorStop(.58, "rgba(255,190,110,.055)"); sill.addColorStop(1, "rgba(255,190,110,0)");
    context.fillStyle = sill; context.fillRect(0, baseline - 20, innerWidth, 40);
  }
  const latestFragment = skyEnabled ? state?.skyFragments?.at(-1) : null;
  const fragmentFrame = latestFragment ? fragmentMomentFrame(latestFragment.earnedAt, renderNow, reducedMotion.matches) : null;
  const fragmentCount = latestFragment ? state.skyFragments.filter((item) => item.constellation === latestFragment.constellation).length : 0;
  const completionAt = latestFragment ? new Date(Date.parse(latestFragment.earnedAt) + 1_250).toISOString() : null;
  const completionFrame = latestFragment && fragmentCount === 6 ? completionMomentFrame(completionAt, renderNow, momentLevel, reducedMotion.matches) : null;
  const fragmentNoticeFrame = fragmentBandMoment(latestFragment, fragmentCount, renderNow, reducedMotion.matches);
  if (fragmentFrame) drawBandSweep(fragmentFrame, baseline);
  if (latestFragment && completionFrame) drawCompletionMoment(latestFragment, completionFrame, baseline);
  if (state) {
    if (opening.active) {
      context.fillStyle = "rgba(246,232,207,.9)";
      context.font = `600 ${Math.max(18, innerHeight * .024)}px "Space Grotesk", system-ui, sans-serif`;
      context.textAlign = "center";
      (opening.lines ?? []).forEach((line, index) => context.fillText(line, innerWidth / 2, baseline + index * Math.max(24, innerHeight * .03)));
    }
    if (closing.kind === "summary") {
      context.fillStyle = "rgba(246,232,207,.9)";
      context.font = `600 ${Math.max(18, innerHeight * .024)}px "Space Grotesk", system-ui, sans-serif`;
      context.textAlign = "center";
      const lines = promisesEnabled ? closing.lines : [closing.lines?.[0], ...(closingThreadCount ? [`${closingThreadCount} threads.`] : [])];
      (lines ?? []).forEach((line, index) => context.fillText(line, innerWidth / 2, baseline + index * Math.max(24, innerHeight * .03)));
    }
    const closingIds = state.closingMoment?.litUserIds ?? [];
    const visibleClosingIds = new Set(closing.kind === "lamps" ? closing.visibleUserIds : []);
    const allLamps = Object.values(state.lamps);
    const heldNewIds = new Set([...queuedArrivals].filter(([, value]) => value.isNew).map(([userId]) => userId));
    stableOrderIds = reconcileLampOrder(
      stableOrderIds, allLamps.filter((lamp) => !heldNewIds.has(lamp.userId)), (lamp) => generateLamp(lamp.userId).hue,
      ({ rowLength, collisions }) => console.warn(`[layout] ${collisions} unavoidable hue-distance violation(s) at row length ${rowLength}`)
    );
    const batch = releaseArrivalBatch(queuedArrivals, arrivalBatchStartedAt, renderNow);
    if (batch.length) {
      stableOrderIds = reconcileLampOrder(stableOrderIds, allLamps, (lamp) => generateLamp(lamp.userId).hue);
      for (const [userId, value] of batch) {
        if (threadsEnabled) {
          const placement = placeThreadArrival(stableOrderIds, userId, state.threads, state.currentStream?.litUserIds, renderNow, lastThreadSlideAt);
          stableOrderIds = placement.orderIds; lastThreadSlideAt = placement.lastSlideAt;
        }
      }
      const base = renderNow + 300;
      batch.forEach(([userId], index) => arrivalStarts.set(userId, base + index * 120));
      queuedArrivals.clear(); arrivalBatchStartedAt = null;
    }
    const allOrdered = stableOrderIds.flatMap((userId) => state.lamps[userId] ? [{ lamp: state.lamps[userId] }] : []);
    const allowedIds = opening.active ? new Set() : closing.kind === "lamps" ? new Set(closingIds) : closing.kind === "none" ? new Set(allLamps.map((lamp) => lamp.userId)) : new Set();
    const visible = selectVisibleLamps(allOrdered.filter((item) => allowedIds.has(item.lamp.userId)).map((item) => item.lamp));
    const glowScale = Math.max(.32, Math.sqrt(6 / Math.max(6, visible.length)));
    const glowAlpha = Math.min(1, 6 / Math.max(6, visible.length));
    const welcomeEffects = neighbourWelcome(visible, state.currentStream, renderNow);
    const targetLayout = layout(visible);
    const motion = animateRowLayout(layoutMotion, targetLayout, renderNow);
    layoutMotion = motion.tracker;
    const laidOut = motion.items;
    const threadLines = threadsEnabled ? threadVisuals(laidOut, state) : { pending: [], solid: [], waiting: [] };
    drawThreadLines(context, threadLines);
    const interactions = reducedMotion.matches ? { ripples: {}, spark: null } : flareInteractions(laidOut, state.flareAtByUserId, renderNow);
    const igniteFrames = new Map(laidOut.flatMap((item) => {
      if (!item.lamp) return []; const visualStart = arrivalStarts.get(item.lamp.userId); const litAt = visualStart === undefined ? item.lamp.lastLitAt : new Date(visualStart).toISOString();
      return [[item.lamp.userId, igniteFrame(litAt, renderNow, reducedMotion.matches, momentLevel)]];
    }));
    const arrivalNudges = {};
    for (const [index, item] of laidOut.entries()) {
      if (!item.lamp) continue; const arrival = igniteFrames.get(item.lamp.userId); if (!arrival?.nudge) continue;
      const left = laidOut[index - 1]?.lamp; const right = laidOut[index + 1]?.lamp;
      if (left) arrivalNudges[left.userId] = (arrivalNudges[left.userId] ?? 0) + arrival.nudge * .15;
      if (right) arrivalNudges[right.userId] = (arrivalNudges[right.userId] ?? 0) - arrival.nudge * .15;
    }
    if (interactions.spark) {
      const from = laidOut.find((item) => item.lamp?.userId === interactions.spark.fromUserId);
      const to = laidOut.find((item) => item.lamp?.userId === interactions.spark.toUserId);
      if (from && to) {
        context.strokeStyle = `rgba(255,170,128,${interactions.spark.intensity * .42})`; context.lineWidth = 1.2;
        context.beginPath(); context.moveTo(from.x, from.y - from.size * .42); context.lineTo(to.x, to.y - to.size * .42); context.stroke();
      }
    }
    for (const [itemIndex, item] of laidOut.entries()) {
      if (item.lamp) {
        const arrivalStart = arrivalStarts.get(item.lamp.userId); if (arrivalStart !== undefined && renderNow < arrivalStart) continue;
        if (queuedArrivals.has(item.lamp.userId)) continue;
        if (closing.kind === "lamps" && !visibleClosingIds.has(item.lamp.userId)) continue;
        const bright = closing.kind === "lamps" || state.currentStream?.litUserIds.includes(item.lamp.userId);
        const opacity = (bright ? 1 : historicalOpacity(item.lamp.streamsSinceLit)) * opening.lampOpacity;
        const grownSize = item.size * lampScale(item.lamp.lifetimeLights);
        const baseRenderedSize = item.tier === 0 ? grownSize : Math.min(grownSize, item.collisionCap);
        const pulseAt = [state.flareAtByUserId?.[item.lamp.userId], state.threadReunionAtByUserId?.[item.lamp.userId]].filter(Boolean).sort().at(-1);
        const flare = flarePulse(pulseAt, renderNow, reducedMotion.matches);
        const fragmentPulse = fragmentNoticeFrame.active && fragmentNoticeFrame.litUserIds.includes(item.lamp.userId) ? fragmentNoticeFrame.pulse : 0;
        const wave = reducedMotion.matches ? 0 : waveIntensity(waveTracker.startedAt, itemIndex, renderNow);
        const welcome = reducedMotion.matches ? undefined : welcomeEffects[item.lamp.userId];
        const ripple = interactions.ripples[item.lamp.userId] ?? 0;
        const isRollCallCurrent = rollCall.active && rollCall.currentUserId === item.lamp.userId;
        const renderedSize = isRollCallCurrent ? baseRenderedSize * 1.25 : Math.min(baseRenderedSize * flare.scale * (1 + wave * .08 + ripple * .08 + fragmentPulse * .06), item.tier === 0 ? Number.POSITIVE_INFINITY : item.collisionCap);
        const ignite = igniteFrames.get(item.lamp.userId); const renderY = item.y + (ignite?.yOffset ?? 0) * renderedSize;
        if (ignite?.ripple > 0 && !reducedMotion.matches) {
          context.save(); bandClip(); context.strokeStyle = `rgba(246,211,151,${(1 - ignite.ripple) * .44})`; context.lineWidth = 1.8;
          context.beginPath(); context.ellipse(item.x, baseline, renderedSize * (.25 + ignite.ripple * 1.25), 5 + ignite.ripple * 9, 0, 0, Math.PI * 2); context.stroke(); context.restore();
        }
        drawLamp(context, item.lamp.userId, item.x, renderY, renderedSize, Math.min(1, opacity + (welcome?.intensity ?? 0) * .28), reducedMotion.matches ? 0 : time, {
          detail: item.tier === 2 ? "essential" : "full", glowScale: glowScale * (1 + flare.intensity * .35 + wave * .25 + fragmentPulse * .35 + (welcome?.intensity ?? 0) * .2 + ripple * .2 + (ignite?.active ? .18 : 0) + (ignite?.bloom ?? 0) * .55), glowAlpha: Math.min(1, glowAlpha * (1 + fragmentPulse * .5 + (ignite?.active ? .22 : 0) + (ignite?.bloom ?? 0) * .5)), extraTilt: welcome?.tilt ?? 0, flameLean: sharedWindLean + (arrivalNudges[item.lamp.userId] ?? 0), scaleY: ignite?.scaleY ?? 1
        });
        if (promisesEnabled) {
          const keptPulse = keptPromisePulse(state.promiseKeptAtByUserId?.[item.lamp.userId], renderNow, reducedMotion.matches);
          if (keptPulse > 0) {
            const gold = context.createRadialGradient(item.x, renderY - renderedSize * .38, 0, item.x, renderY - renderedSize * .38, renderedSize * .72);
            gold.addColorStop(0, `rgba(255,224,143,${keptPulse * .35})`); gold.addColorStop(1, "rgba(255,196,92,0)");
            context.fillStyle = gold; context.beginPath(); context.arc(item.x, renderY - renderedSize * .38, renderedSize * .72, 0, Math.PI * 2); context.fill();
          }
          const knot = promiseKnotFrame(state.promiseAtByUserId?.[item.lamp.userId], renderNow, reducedMotion.matches);
          if (knot.visible) {
            context.save(); context.strokeStyle = `rgba(255,213,137,${.42 + knot.progress * .38})`; context.lineWidth = Math.max(1.5, renderedSize * .014);
            context.beginPath(); context.arc(item.x, renderY - renderedSize * .03, renderedSize * (.018 + knot.progress * .025), 0, Math.PI * 2 * knot.progress); context.stroke(); context.restore();
          }
        }
        if (ignite?.bloom > 0) {
          const wickY = renderY - renderedSize * .47, bloom = context.createRadialGradient(item.x, wickY, 0, item.x, wickY, renderedSize * .42);
          bloom.addColorStop(0, `rgba(255,246,218,${ignite.bloom * .68})`); bloom.addColorStop(.26, `rgba(247,204,119,${ignite.bloom * .28})`); bloom.addColorStop(1, "rgba(245,195,105,0)");context.fillStyle=bloom;context.beginPath();context.arc(item.x,wickY,renderedSize*.52,0,Math.PI*2);context.fill();
        }
        if (!showNames || (item.tier !== 0 && !isRollCallCurrent)) continue;
        const baseLabelSize = isRollCallCurrent ? Math.max(16, item.size * .16) : Math.max(12, item.size * .105);
        context.font = `600 ${baseLabelSize}px ${LABEL_FONT_FALLBACK}`;
        const fitted = fitNamePlate(context.measureText(item.lamp.displayName).width, baseLabelSize, Math.max(72, item.size * .82));
        const labelSize = fitted.fontSize;
        context.font = `600 ${labelSize}px ${LABEL_FONT_FALLBACK}`;
        context.textAlign = "center";
        const labelY = renderY + item.size * .27;
        const labelWidth = fitted.plateWidth;
        context.fillStyle = `rgba(4, 9, 12, ${Math.max(.58, opacity * .74)})`;
        context.beginPath(); context.roundRect(item.x - labelWidth / 2, labelY - labelSize * .88, labelWidth, labelSize * 1.45, labelSize * .7); context.fill();
        context.strokeStyle = `rgba(237, 201, 133, ${Math.max(.16, opacity * .3)})`; context.lineWidth = 1; context.stroke();
        context.fillStyle = `rgba(246, 232, 207, ${Math.max(.52, opacity)})`;
        context.fillText(item.lamp.displayName, item.x, labelY);
        const greeting = returnGreeting(item.lamp, state.currentStream, renderNow);
        if (greeting) {
          context.fillStyle = "rgba(246,232,207,.72)";
          context.font = `500 ${Math.max(11, labelSize * .72)}px ${LABEL_FONT_FALLBACK}`;
          context.fillText(greeting, item.x, labelY + labelSize * 1.35);
        }
      } else {
        drawLamp(context, "lamplight-cluster", item.x, item.y, Math.min(item.size * 1.08, item.collisionCap), .25, 0, { detail: "essential", glowScale, glowAlpha });
        context.fillStyle = "rgba(246,232,207,.72)"; context.font = `700 ${item.size * .16}px system-ui, sans-serif`; context.textAlign = "center";
        context.fillText(`+${item.cluster}`, item.x, item.y + item.size * .25);
      }
    }
    if (promisesEnabled && closing.kind === "none" && !opening.active && closingHintVisible(state, renderNow)) {
      const hint = closingHintPosition(laidOut[0]?.tier ?? 0, innerWidth, innerHeight, baseline, selectedLayout);
      context.fillStyle = "rgba(246,232,207,.42)"; context.font = `500 ${Math.max(12, innerHeight * .014)}px "Space Grotesk", system-ui, sans-serif`; context.textAlign = "right";
      context.fillText("back next time? type !back", hint.x, hint.y);
    }
    if (fragmentNoticeFrame.active && !opening.active && closing.kind === "none") {
      context.save(); bandClip(); context.globalAlpha = fragmentNoticeFrame.alpha;
      context.fillStyle = "rgba(246,232,207,.78)"; context.font = `500 ${Math.max(14, innerHeight * .014)}px "Space Grotesk",system-ui,sans-serif`; context.textAlign = "center";
      const noticeY = selectedLayout === "top" ? baseline + 54 : Math.min(innerHeight * .965, baseline + 58);
      context.fillText(fragmentNoticeFrame.text, innerWidth / 2, noticeY); context.restore();
    }
    for (const [userId, startedAt] of arrivalStarts) if (renderNow - startedAt > 1_100) arrivalStarts.delete(userId);
  }
  if (skyEnabled && state) {
    const landed = opening.active ? [] : (state.currentStream?.litUserIds ?? []).filter(id => !queuedArrivals.has(id) && (arrivalStarts.get(id) === undefined || renderNow >= arrivalStarts.get(id) + (reducedMotion.matches || momentLevel === "quiet" ? 0 : 350)));
    const model = skyPanelTransitionAt(state.skyFragments, renderNow, momentLevel, reducedMotion.matches, skyDisplayLock).transition.rendered;
    const complete = Boolean(skyDisplayLock && model.counts[skyDisplayLock.constellation] === 6);
    const progress = skyProgressFrame(skyProgressTracker, state, landed, thresholdN, renderNow, complete, reducedMotion.matches);
    skyProgressTracker = progress.tracker;
    drawSkyOverlay(context, state, innerWidth, innerHeight, opening.active, renderNow, selectedLayout, momentLevel, reducedMotion.matches, skyDisplayLock, 1250, reducedMotion.matches ? 0 : opening.panelPulse ?? 0, progress);
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
      const nextState = packet.state, receivedAt = Date.now();
      for (const lamp of Object.values(nextState.lamps ?? {})) {
        const changed = state?.lamps?.[lamp.userId]?.lastLitAt !== lamp.lastLitAt;
        if (changed && Math.abs(receivedAt - Date.parse(lamp.lastLitAt)) < 5_000) {
          queuedArrivals.set(lamp.userId, { litAt: lamp.lastLitAt, isNew: !state?.lamps?.[lamp.userId] });
          arrivalBatchStartedAt ??= receivedAt;
        }
      }
      state = nextState; selectedLayout = packet.layout === "top" ? "top" : "bottom";
      skyDisplayLock = updateSkyDisplayLock(skyDisplayLock, state);
      thresholdN = packet.thresholdN ?? 10;
      showNames = packet.showNames !== false;
      threadsEnabled = packet.threadsEnabled === true;
      skyEnabled = packet.skyEnabled === true;
      windEnabled = packet.windEnabled === true;
      promisesEnabled = packet.promisesEnabled !== false;
      momentLevel = ["quiet", "normal", "big"].includes(packet.moments) ? packet.moments : "normal";
      preferences = packet.preferences ?? preferences; demo.hidden = !state.demoReplay; drawOnce();
      if (reducedMotion.matches && skyEnabled && state.currentStream) {
        // Complete batched landings and reset the static full-bar hold without an animation loop.
        for (const delay of [2000, 2800, 4300]) setTimeout(drawOnce, delay);
      }
      if (reducedMotion.matches && state.closingMoment) setTimeout(drawOnce, 10_050);
      if (reducedMotion.matches && Object.values(state.flareAtByUserId ?? {}).some((value) => Date.now() - Date.parse(value) < 600)) setTimeout(drawOnce, 610);
      if (reducedMotion.matches && Object.values(state.threadReunionAtByUserId ?? {}).some((value) => Date.now() - Date.parse(value) < 600)) setTimeout(drawOnce, 610);
    }
  });
  socket.addEventListener("close", () => { status.hidden = false; status.textContent = "RECONNECTING"; setTimeout(connect, 1000); });
}

addEventListener("resize", () => { resize(); drawOnce(); });
reducedMotion.addEventListener("change", drawOnce);
resize(); connect(); render(0);
