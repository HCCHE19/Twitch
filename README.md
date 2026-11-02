# Lamplight

[See a real receipt](https://hcche19.github.io/Twitch/)

Lamplight gives a silent Twitch viewer one gentle action: send `!lamp`, `!lurk`, or one emote by itself. Their persistent, procedurally generated lamp brightens on the OBS overlay. When the stream ends, Lamplight seals a tamper-evident Presence Receipt from its EventSub ledger. It is attendance, not a leaderboard or recap.

All lamp and sky artwork and motion are generated in code; the only bundled assets are the Space Grotesk font under the OFL and the constellation star positions and magnitudes from the d3-celestial dataset under its BSD licence, with the licence text included in this repo.

## Requirements

- macOS, Node.js 20 or newer, OBS, and the Twitch CLI
- A Twitch developer application whose OAuth redirect URL is exactly `http://localhost:3939`
- The broadcaster account signed into the Twitch CLI

## Twitch setup

1. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps), register an application. Add `http://localhost:3939` as its OAuth redirect URL.
2. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` to the application's Client ID and `TWITCH_CHANNEL_LOGIN` to the broadcaster login in lowercase.
3. Mint the minimum-scope broadcaster user token:

   ```bash
   twitch token -u -p 3939 -s user:read:chat
   ```

4. Put only the User Access Token value in `TWITCH_ACCESS_TOKEN`. Never commit `.env`.
5. Install and build:

   ```bash
   npm install
   npm run build
   ```

The app subscribes to `channel.chat.message`, `stream.online`, and `stream.offline`. It never requests permission to write to chat. Twitch references: [Example Chatbot](https://dev.twitch.tv/docs/chat/chatbot-guide/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), and [subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

## Run with OBS

1. Run `npm start` and leave that Terminal window open.
2. In OBS, add a Browser source using `http://localhost:8787/overlay/`, width `1920`, and height `1080`. Leave Local file, Control audio via OBS, and custom frame rate off.
3. Start a Twitch stream. A viewer sends `!lamp`, `!lurk`, or exactly one emote. Lamplight never replies in chat. Once lit, another message containing exactly one emote produces a 600ms flare, with a ten-second per-viewer cooldown and no counter.
   If a previous stream exists, the band first shows its lamp count and how many of those viewers have returned, then fades the persistent lamps in after ten seconds.
   When a dim lamp relights, its full-size name plate briefly says which lifetime stream attendance this is.
4. While live, Lamplight samples Twitch's reported `viewer_count` immediately and every 60 seconds, recording it beside the number of lamps lit at that moment.
5. Stop the stream. Lamps extinguish in first-lit order, the band briefly reports total and returning lamps, and Twitch's `stream.offline` event automatically writes private JSON and name-only HTML under `receipts/`.

Set `LAYOUT=bottom` (the default windowsill) or `LAYOUT=top` in `.env`, then restart Lamplight to compare OBS placement.
Open `http://localhost:8787/control/` privately to compact or hide the band.
The same private page can start a roll call and mark the highlighted lamp called; it cycles through uncalled lamps in first-lit order and turns off when complete.
Set `THRESHOLD_N` in `.env` (default `10`) to choose when the once-per-stream left-to-right lamp wave runs.
Set `SHOW_NAMES=false` to hide every name plate and return greeting on the overlay; receipt names are unaffected.
Name plates support Japanese and Chinese display names through system-font fallbacks and bounded text fitting.
When a lamp lights for the first time ever, its rendered neighbours briefly tilt and brighten toward it in welcome.
Flares send a delayed, fainter pulse to adjacent lamps; two different viewers flaring within five seconds briefly draw a thin spark between them.

### Optional constellation sky and wind

Both additions are isolated and disabled by default. Set `SKY=true` to let each stream that reaches `THRESHOLD_N` earn one deterministic, non-duplicate fragment from a 72-fragment sky: twelve zodiac constellations with six connected regions each. The top-right panel shows untouched, in-progress, and complete constellations; the opening card enlarges the latest progress, and receipts show the full sky plus the display names present at the earning moment. Fragment events, including the stable user IDs required for rebuild, are hash-chained in the private ledger; public receipt HTML exposes names only. The numeric star positions come from the permissively licensed [d3-celestial constellation data](https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json); Lamplight generates its own regions, lines, glyphs, and animation in code.

Set `WIND=true` to make five different viewers flaring within ten seconds lean every flame together for about one second. Wind has a ten-second global cooldown and adds no chat or ledger output.

### Moments without taking over the stream

Lamplight keeps its arrival and collection moments inside the lamp band and corner panel by design. A newly lit lamp drops into the sill, lands with a brief wick bloom and sends one light ripple past its neighbours. A newly earned sky fragment produces a restrained sweep along the band and settles inside the panel. Completing all six regions of a constellation lights its stars in sequence in a fixed area above the row, flares the band once, and returns the drawing to the panel; it never uses frame-edge flashes or strobing.

Set `MOMENTS=quiet`, `normal`, or `big` in `.env`, then restart Lamplight. `normal` is the default. `quiet` keeps only the arrival ripple and panel effects, with no constellation drawn above the row. `big` is intended for demos and allows a completion moment to use up to half the frame height; `normal` is capped at one third. Reduced-motion preferences replace movement with brief, low-intensity emphasis.

### Optional red threads

Red threads are isolated behind `THREADS=false` by default. Set `THREADS=true` and restart to enable them. An already-lit viewer may send `!tie Display Name` once per stream. The target must be another lamp lit tonight; names match case-insensitively by exact name first, then unique prefix. The one-way request is a faint dashed line and is not recorded. If the target sends `!tie` back in the same stream, Lamplight records a mutual thread and draws a thin solid red line. Each lamp keeps its oldest three mutual threads. In later streams, a thread returns when both lamps are lit; while only one is present it hangs from that lamp with a small knot, and both lamps flare when reunited.

Either party may use `!untie Display Name`; bare `!untie` works only when that viewer has exactly one thread. A moderator may use `!untie Name A | Name B`, or `!untie Display Name` when that lamp has exactly one thread. Accepted removals are ledger events. Invalid, ambiguous, self, broadcaster, absent, dim, over-cap, or second-outgoing attempts have no visible effect. The bot never responds in chat. Thread-enabled receipts list mutual pairs tied that night and four rule-generated lines: lit-time range, first arrival, longest streak, and thread count.

If the offline event never arrives, run `npm run finalize`. Verify a receipt with:

```bash
npm run verify -- receipts/<stream-id>.json
```

The receipt includes the minute-by-minute Twitch viewer samples, lit-lamp samples, both peaks, and a plain-English comparison. Viewers can find their name, see a ten-dot attendance history oldest on the left, and see up to three display names with whom they have shared the most streams. These are different measurements: Twitch reports concurrent viewers, while lit lamps prove only that a viewer sent a qualifying presence message. The verifier recomputes the event-log chain, chain anchors, event count, source-message references, and receipt hash. `events.jsonl` is the ledger; `state.json` is derived from it. To prove that, run `npm run rebuild`.

## Demo and tests

Replay Twitch-shaped fixtures through the production handlers at an adjustable speed:

```bash
npm run demo -- test/fixtures/demo-events.jsonl --speed 2
npm run demo -- --lamps 30 --speed 1000
```

Preview each occasion moment separately. Each command waits ten seconds after starting its server, giving you time to open the printed overlay URL. Stop it with `Control+C` before running the next command.

```bash
npm run demo -- --moment ignite --port 8790
npm run demo -- --moment fragment --port 8790
npm run demo -- --moment complete --port 8790
```

Use `--delay 20` if you want a longer setup window. The fragment and completion demos enable their synthetic sky state only inside the demo server; they do not alter the real ledger.

The overlay displays `DEMO REPLAY`; demo output must not be presented as a real Twitch test.

```bash
npm test
npm run build
npm run secrets:check
```

## Why presence

- [Nonnecke and Preece (2000)](https://www.cis.uoguelph.ca/~nonnecke/research/demographics.pdf) found lurkers represented 45.5%–82% of members across 109 mailing lists.
- [Nematzadeh et al. (2019)](https://royalsocietypublishing.org/doi/10.1098/rsos.191412), analysing 1.28 billion Twitch messages in *Royal Society Open Science*, found participation per user collapses once a channel exceeds roughly 40 messages per five minutes.
- NINJAL (2026) reported that the busiest minute of a VTuber stream contained 683 comments while the streamer read one, and fewer than 10% received any acknowledgement.
- [Wohn and Freeman (2020)](https://doi.org/10.1145/3391614.3393653), ACM IMX, documented a streamer asking lurkers to post an emote so she could read their names, and small streamers hiding viewer counts because low numbers were discouraging.
- Press, not research: [Tubefilter reported in August 2025](https://www.tubefilter.com/2025/08/27/twitch-viewbot-crackdown-zach-bussey/) that more than 41,000 channels were flagged during Twitch's viewbot crackdown and that analysts saw 5%–24% viewership drops, which Twitch disputed.

These sources motivate the problem; no study yet shows that lightweight presence makes viewers return. Lamplight makes that hypothesis testable without turning presence into competition.

## Privacy and boundaries

Real `data/` and `.env` are gitignored. Private receipt JSON may contain Twitch user IDs because verification needs stable identity; public receipt HTML contains display names only. There is no runtime AI, chat output, ranking, scoring, clipping, stream summary, Twitch Extension, external artwork, audio, or game footage.

The committed [fictional sample receipt](public/receipt/sample.html) contains names only. It is a design sample, not evidence from a real stream.

Run `npm run export` to rebuild the self-contained GitHub Pages version in `docs/` from that sample and the production lamp renderer.

## Credits and licences

- **Space Grotesk:** bundled label font, licensed under the SIL Open Font License. The licence text is included at [`public/fonts/OFL.txt`](public/fonts/OFL.txt).
- **d3-celestial:** constellation star-position and magnitude data by Olaf Frohn, used under the BSD 3-Clause licence. Lamplight uses the numeric data and generates its own sky regions, line styling, glyphs, and motion. The source datasets are [d3-celestial `constellations.lines.json`](https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json) and [`stars.6.json`](https://github.com/ofrohn/d3-celestial/blob/master/data/stars.6.json); the licence text is included at [`LICENSES/d3-celestial-BSD-3-Clause.txt`](LICENSES/d3-celestial-BSD-3-Clause.txt).
