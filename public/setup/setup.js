const parameters=new URLSearchParams(location.search),status=document.querySelector("#status"),button=document.querySelector(".connect");
if(parameters.get("connected")==="1"){status.textContent="Twitch connected. Lamplight is starting.";button.textContent="Reconnect Twitch"}
else if(parameters.has("error"))status.textContent=parameters.get("error")==="config"?"Add TWITCH_CLIENT_SECRET to .env, then try again.":"Setup is not available yet.";
else{const response=await fetch("/setup/status"),body=await response.json();if(body.connected){status.textContent="Twitch is connected.";button.textContent="Reconnect Twitch"}}
