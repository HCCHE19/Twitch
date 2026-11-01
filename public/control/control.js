const compact = document.querySelector("#compact");
const hidden = document.querySelector("#hidden");
const status = document.querySelector("#status");
let socket;

function send() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "preferences", compact: compact.checked, hidden: hidden.checked }));
}
function connect() {
  socket = new WebSocket(`ws://${location.host}/ws`);
  socket.addEventListener("open", () => { status.textContent = "Connected"; });
  socket.addEventListener("message", (event) => {
    const packet = JSON.parse(event.data);
    if (packet.type === "state") { compact.checked = Boolean(packet.preferences?.compact); hidden.checked = Boolean(packet.preferences?.hidden); }
  });
  socket.addEventListener("close", () => { status.textContent = "Reconnecting"; setTimeout(connect, 1000); });
}
compact.addEventListener("change", send); hidden.addEventListener("change", send); connect();
