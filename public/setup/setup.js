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
if(parameters.get("connected")==="1"){status.textContent="Twitch connected. Lamplight is starting.";button.textContent="Reconnect Twitch"}
else if(parameters.has("error"))status.textContent=parameters.get("error")==="config"?"Add TWITCH_CLIENT_SECRET to .env, then try again.":"Setup is not available yet.";
else{const response=await fetch("/setup/status"),body=await response.json();if(body.connected){status.textContent="Twitch is connected.";button.textContent="Reconnect Twitch"}}
