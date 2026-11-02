const compact = document.querySelector("#compact");
const hidden = document.querySelector("#hidden");
const rollCall = document.querySelector("#roll-call");
const called = document.querySelector("#called");
const current = document.querySelector("#current");
const status = document.querySelector("#status");
const fields = { sky: document.querySelector("#sky"), threads: document.querySelector("#threads"), wind: document.querySelector("#wind"), promises: document.querySelector("#promises"), showNames: document.querySelector("#show-names"), moments: document.querySelector("#moments"), thresholdN: document.querySelector("#threshold"), layout: document.querySelector("#layout") };
let socket;
let latest;

function send() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "preferences", compact: compact.checked, hidden: hidden.checked, rollCall: rollCall.checked }));
}
function sendSettings() {
  const thresholdN = Number(fields.thresholdN.value);
  if (!Number.isInteger(thresholdN) || thresholdN < 1 || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "settings", settings: { sky: fields.sky.checked, threads: fields.threads.checked, wind: fields.wind.checked, promises: fields.promises.checked, showNames: fields.showNames.checked, moments: fields.moments.value, thresholdN, layout: fields.layout.value } }));
}
function updateCurrent() {
  const preferences = latest?.preferences; const stream = latest?.state?.currentStream;
  if (!preferences?.rollCall || !stream) { current.textContent = "No active roll call"; called.disabled = true; return; }
  const remaining = stream.litUserIds.filter((userId) => !(preferences.rollCallCalled ?? []).includes(userId));
  if (!remaining.length) { current.textContent = "Roll call complete"; called.disabled = true; return; }
  const index = Math.floor(Math.max(0, Date.now() - Date.parse(preferences.rollCallStartedAt)) / 4000) % remaining.length;
  const lamp = latest.state.lamps[remaining[index]];
  current.textContent = lamp ? `Current: ${lamp.displayName}` : "Current lamp"; called.disabled = false;
}
function connect() {
  socket = new WebSocket(`ws://${location.host}/ws`);
  socket.addEventListener("open", () => { status.textContent = "Connected"; });
  socket.addEventListener("message", (event) => {
    const packet = JSON.parse(event.data);
    if (packet.type === "state") {
      latest = packet; compact.checked = Boolean(packet.preferences?.compact); hidden.checked = Boolean(packet.preferences?.hidden); rollCall.checked = Boolean(packet.preferences?.rollCall);
      const settings = packet.settings; if (settings) { for (const key of ["sky", "threads", "wind", "promises", "showNames"]) fields[key].checked = Boolean(settings[key]); fields.moments.value = settings.moments; fields.thresholdN.value = String(settings.thresholdN); fields.layout.value = settings.layout; }
      updateCurrent();
    }
  });
  socket.addEventListener("close", () => { status.textContent = "Reconnecting"; setTimeout(connect, 1000); });
}
compact.addEventListener("change", send); hidden.addEventListener("change", send); rollCall.addEventListener("change", send);
Object.values(fields).forEach((field) => field.addEventListener("change", sendSettings));
called.addEventListener("click", () => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "roll-call-called" })); });
setInterval(updateCurrent, 250); connect();
