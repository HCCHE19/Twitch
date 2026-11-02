# Lamplight

Lamplight gives a silent Twitch viewer one gentle action: send `!lamp`, `!lurk`, or one emote by itself. Their persistent, procedurally generated lamp brightens on the OBS overlay. When the stream ends, Lamplight seals a tamper-evident Presence Receipt from its EventSub ledger. It is attendance, not a leaderboard or recap.

All lamp artwork and motion are procedurally generated in this repo; the only bundled asset is the Space Grotesk font under the OFL.

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
4. While live, Lamplight samples Twitch's reported `viewer_count` immediately and every 60 seconds, recording it beside the number of lamps lit at that moment.
5. Stop the stream. Lamps extinguish in first-lit order, the band briefly reports total and returning lamps, and Twitch's `stream.offline` event automatically writes private JSON and name-only HTML under `receipts/`.

Set `LAYOUT=bottom` (the default windowsill) or `LAYOUT=top` in `.env`, then restart Lamplight to compare OBS placement.
Open `http://localhost:8787/control/` privately to compact or hide the band.

If the offline event never arrives, run `npm run finalize`. Verify a receipt with:

```bash
npm run verify -- receipts/<stream-id>.json
```

The receipt includes the minute-by-minute Twitch viewer samples, lit-lamp samples, both peaks, and a plain-English comparison. These are different measurements: Twitch reports concurrent viewers, while lit lamps prove only that a viewer sent a qualifying presence message. The verifier recomputes the event-log chain, chain anchors, event count, source-message references, and receipt hash. `events.jsonl` is the ledger; `state.json` is derived from it. To prove that, run `npm run rebuild`.

## Demo and tests

Replay Twitch-shaped fixtures through the production handlers at an adjustable speed:

```bash
npm run demo -- test/fixtures/demo-events.jsonl --speed 2
npm run demo -- --lamps 30 --speed 1000
```

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
