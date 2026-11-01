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
  const maxSize = count === 1 ? 320 : count <= 4 ? 190 : 128;
  const size = Math.max(42, Math.min(maxSize, Math.min(cellWidth * .68, cellHeight * .64)));
  return items.map((item, index) => ({
    ...item,
    x: (index % columns + .5) * cellWidth,
    y: count === 1 ? innerHeight * .70 : (Math.floor(index / columns) + .70) * cellHeight,
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
        const labelSize = Math.max(12, item.size * .105);
        context.font = `600 ${labelSize}px "Space Grotesk", system-ui, sans-serif`;
        context.textAlign = "center";
        const labelY = item.y + item.size * .27;
        const labelWidth = context.measureText(item.lamp.displayName).width + labelSize * 1.5;
        context.fillStyle = `rgba(4, 9, 12, ${Math.max(.58, opacity * .74)})`;
        context.beginPath(); context.roundRect(item.x - labelWidth / 2, labelY - labelSize * .88, labelWidth, labelSize * 1.45, labelSize * .7); context.fill();
        context.strokeStyle = `rgba(237, 201, 133, ${Math.max(.16, opacity * .3)})`; context.lineWidth = 1; context.stroke();
        context.fillStyle = `rgba(246, 232, 207, ${Math.max(.52, opacity)})`;
        context.fillText(item.lamp.displayName, item.x, labelY);
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
  socket.addEventListener("open", () => { status.textContent = "LIVE DATA"; status.hidden = true; });
  socket.addEventListener("message", (message) => {
    const packet = JSON.parse(message.data);
    if (packet.type === "state") { state = packet.state; demo.hidden = !state.demoReplay; drawOnce(); }
  });
  socket.addEventListener("close", () => { status.hidden = false; status.textContent = "RECONNECTING"; setTimeout(connect, 1000); });
}

addEventListener("resize", () => { resize(); drawOnce(); });
reducedMotion.addEventListener("change", drawOnce);
resize(); connect(); render(0);
