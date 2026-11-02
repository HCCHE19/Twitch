const compact = document.querySelector("#compact");
const hidden = document.querySelector("#hidden");
const rollCall = document.querySelector("#roll-call");
const called = document.querySelector("#called");
const current = document.querySelector("#current");
const status = document.querySelector("#status");
let socket;
let latest;

function send() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "preferences", compact: compact.checked, hidden: hidden.checked, rollCall: rollCall.checked }));
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
    if (packet.type === "state") { latest = packet; compact.checked = Boolean(packet.preferences?.compact); hidden.checked = Boolean(packet.preferences?.hidden); rollCall.checked = Boolean(packet.preferences?.rollCall); updateCurrent(); }
  });
  socket.addEventListener("close", () => { status.textContent = "Reconnecting"; setTimeout(connect, 1000); });
}
compact.addEventListener("change", send); hidden.addEventListener("change", send); rollCall.addEventListener("change", send);
called.addEventListener("click", () => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "roll-call-called" })); });
setInterval(updateCurrent, 250); connect();
