import { drawLamp, historicalOpacity, lampScale } from "/shared/lamp.js";

const canvas = document.querySelector("#lamps");
const context = canvas.getContext("2d");
const status = document.querySelector("#status");
const demo = document.querySelector("#demo");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let state = null;
let animationFrame = 0;

function resize() {
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function layout(items) {
  const count = Math.max(1, items.length);
  const columns = count === 1 ? 1 : Math.min(12, Math.max(1, Math.ceil(Math.sqrt(count * (innerWidth / innerHeight)))));
  const rows = Math.ceil(count / columns);
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / Math.max(1, rows);
  const maxSize = count === 1 ? 220 : count <= 4 ? 160 : 118;
  const size = Math.max(42, Math.min(maxSize, Math.min(cellWidth * .68, cellHeight * .64)));
  return items.map((item, index) => ({
    ...item,
    x: (index % columns + .5) * cellWidth,
    y: (Math.floor(index / columns) + .72) * cellHeight,
    size
  }));
}

function render(time) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  if (state) {
    const lamps = Object.values(state.lamps).sort((a, b) => b.lastLitAt.localeCompare(a.lastLitAt));
    const visible = lamps.slice(0, 60).map((lamp) => ({ lamp }));
    const overflow = lamps.length - visible.length;
    if (overflow > 0) visible.push({ cluster: overflow });
    for (const item of layout(visible)) {
      if (item.lamp) {
        const bright = state.currentStream?.litUserIds.includes(item.lamp.userId);
        const opacity = bright ? 1 : historicalOpacity(item.lamp.streamsSinceLit);
        drawLamp(context, item.lamp.userId, item.x, item.y, item.size * lampScale(item.lamp.lifetimeLights), opacity, reducedMotion.matches ? 0 : time);
        context.fillStyle = `rgba(246, 232, 207, ${Math.max(.46, opacity)})`;
        context.font = `600 ${Math.max(11, item.size * .12)}px "Space Grotesk", system-ui, sans-serif`;
        context.textAlign = "center";
        context.fillText(item.lamp.displayName, item.x, item.y + item.size * .25);
      } else {
        drawLamp(context, "lamplight-cluster", item.x, item.y, item.size * 1.08, .25, 0);
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
  socket.addEventListener("open", () => { status.textContent = "LIVE DATA"; });
  socket.addEventListener("message", (message) => {
    const packet = JSON.parse(message.data);
    if (packet.type === "state") { state = packet.state; demo.hidden = !state.demoReplay; drawOnce(); }
  });
  socket.addEventListener("close", () => { status.textContent = "RECONNECTING"; setTimeout(connect, 1000); });
}

addEventListener("resize", () => { resize(); drawOnce(); });
reducedMotion.addEventListener("change", drawOnce);
resize(); connect(); render(0);
