const parameters=new URLSearchParams(location.search),status=document.querySelector("#status"),button=document.querySelector(".connect");
let navigating=false;
button.addEventListener("click",event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(navigating)return;navigating=true;
  button.classList.add("pressed");button.setAttribute("aria-busy","true");
  status.textContent="Opening Twitch…";
  setTimeout(()=>location.assign(button.href),160);
});
addEventListener("pageshow",()=>{navigating=false;button.classList.remove("pressed");button.removeAttribute("aria-busy")});
if(parameters.has("error"))status.textContent=parameters.get("error")==="config"?"Add TWITCH_CLIENT_SECRET to .env, then try again.":"Setup is not available yet.";
else {
  try {
    const response=await fetch("/setup/status",{cache:"no-store"});
    if(!response.ok)throw new Error("Status unavailable");
    const body=await response.json();
    if(body.connected){status.textContent="Connected";button.textContent="Reconnect Twitch";setTimeout(()=>{if(!navigating)location.replace("/control")},1000)}
  } catch {status.textContent="Could not check connection. Try Connect Twitch again."}
}
