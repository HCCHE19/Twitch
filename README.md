# Lamplight

Lamplight gives a silent Twitch viewer one gentle action: send `!lamp`, `!lurk`, or one emote by itself. Their persistent, procedurally generated lamp brightens on the OBS overlay. When the stream ends, Lamplight seals a tamper-evident Presence Receipt from its EventSub ledger. It is attendance, not a leaderboard or recap.

All lamp and sky artwork and motion are generated in code; the only bundled assets are the Space Grotesk font under the OFL and the constellation star positions and magnitudes from the d3-celestial dataset under its BSD licence, with the licence text included in this repo.

## Streamer setup

You need Node.js 20 or newer and OBS. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps), create an application with the exact OAuth redirect URL `http://localhost:3939`. Twitch credentials stay in `.env` and are never sent to the browser.

1. **Install.** Run `npm install`, copy `.env.example` to `.env`, then add the app's client id, client secret, and your lowercase Twitch channel login. `TWITCH_ACCESS_TOKEN` is optional compatibility for an existing manual token.
2. **Start.** Run `npm run build && npm start` and leave that Terminal window open.
3. **Connect.** Open `http://localhost:8787/setup`, click **Connect Twitch**, approve the single read-only `user:read:chat` scope, and return to Lamplight.
4. **Add OBS.** Add `http://localhost:8787/overlay/` as a 1920×1080 Browser source. Leave Local file, Control audio via OBS, and custom frame rate off.

Viewer side: one emote lights your lamp; everything else is optional.

Lamplight subscribes to `channel.chat.message`, `stream.online`, and `stream.offline` and never requests chat-write permission. It also accepts one Unicode emoji, `!lamp`, or `!lurk`. Twitch references: [Example Chatbot](https://dev.twitch.tv/docs/chat/chatbot-guide/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), and [subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

## Optional controls and features

Open `http://localhost:8787/control/` to change Sky, Threads, Wind, Promises, name plates, moment level, fragment threshold, and top/bottom layout live. The same private page controls compact mode, hiding the band, and roll call. Settings are stored locally in `data/settings.json`; `.env` remains credentials-only.

- **Memory:** prior lamps return dim, relighting shows lifetime attendance, `!back` creates a no-pressure promise, and a kept promise gives a gold landing pulse and extra fragment-threshold weight.
- **Flares and wind:** an already-lit viewer's single Twitch emote gives a cooldown-limited flare. Neighbours ripple; two nearby flares can spark; five different flares can trigger wind when enabled.
- **Sky:** reaching the threshold earns one deterministic, non-duplicate fragment from twelve code-drawn zodiac constellations. The corner panel and local receipt derive progress from the ledger.
- **Moments:** arrival and fragment effects stay inside the lamp band and corner panel. `quiet`, `normal`, and `big` change intensity; reduced-motion preferences remove travel and bounce.
- **Threads:** a lit viewer can use `!tie name`, `!tie @name`, or bare `!tie` for the lamp immediately left. Mutual ties persist; `!untie` removes them; streaks count consecutive streams together. The bot never replies in chat.

The broadcaster can type `!closing` to show the quiet `!back` invitation. It otherwise appears only after 90% of the median duration of the last five completed streams, and only when that median is at least 30 minutes. On dense rows it sits above the sill end, clear of the lamps.

When Twitch sends `stream.offline`, Lamplight writes private JSON and HTML to `receipts/`. If that event never arrives, run `npm run finalize`. Verify the ledger and receipt with `npm run verify -- receipts/<stream-id>.json`; rebuild derived state with `npm run rebuild`. These commands, the control page, `npm run privacy:migrate`, and all feature toggles are optional.

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

The full-night replay is about four minutes and enables Sky, Threads, Wind, Promises, names, threshold 3, and normal moments:

```bash
npm run demo -- --moment night --port 8790
```

When events overlap, ignite always plays immediately. Fragment and constellation moments play in order—fragment first, completion second—and none are dropped; the corner panel advances only with its own moment. Flares and closing continue underneath without interrupting that queue.

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

## What's next

- Let viewers see their own attendance record through a Twitch login.
- Add a private `!me` command.
- Let mutual threads reach across channels.
- Package Lamplight as a one-click install.

## Privacy and boundaries

No chat text is stored, only who lit a lamp and when; receipts never leave the streamer's machine, and nothing about viewers is published. Derived promise, flare, and mutual-thread events contain only the identities and times needed to rebuild those features. Real `data/`, `receipts/`, and `.env` are gitignored; private receipt JSON may contain Twitch user IDs because verification needs stable identity. There is no runtime AI, chat output, ranking, scoring, clipping, stream summary, Twitch Extension, external artwork, audio, or game footage.

## Credits and licences

- **Space Grotesk:** bundled label font, licensed under the SIL Open Font License. The licence text is included at [`public/fonts/OFL.txt`](public/fonts/OFL.txt).
- **d3-celestial:** constellation star-position and magnitude data by Olaf Frohn, used under the BSD 3-Clause licence. Lamplight uses the numeric data and generates its own sky regions, line styling, glyphs, and motion. The source datasets are [d3-celestial `constellations.lines.json`](https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json) and [`stars.6.json`](https://github.com/ofrohn/d3-celestial/blob/master/data/stars.6.json); the licence text is included at [`LICENSES/d3-celestial-BSD-3-Clause.txt`](LICENSES/d3-celestial-BSD-3-Clause.txt).
