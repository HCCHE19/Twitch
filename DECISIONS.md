# Decisions

## 2026-11-01 — Product and delivery constraints

**Decided:** Build Lamplight as a solo TwitchCon hackathon entry: silent viewers can signal presence with one emote, `!lamp`, or `!lurk`; persistent deterministic lamps brighten per stream, accrue streak/size, and produce hash-chained Presence Receipts. No rankings, chat output, runtime AI, Extensions, recaps, clips, summaries, third-party visual/audio assets, or prohibited lookalikes. One OBS browser source; minimal Node/TypeScript/`ws`/Vitest stack. Work milestone-by-milestone with tests, secret scan, commit, and status. Stop loss at Nov 2 12:00 Sydney; target submission Nov 3 06:30 Sydney.

**Action:** Specified a single local TypeScript service, Canvas 2D overlay, JSON/JSONL persistence, minimum Twitch scope and EventSub set, receipt verification, tests, fallbacks, and optional features gated behind real core proof. No implementation begins until the user says `go`.

## 2026-11-01 — Originality and evidence

**Decided:** All lamp art/motion is code-generated; palette is amber, teal, and rose on near-black halos; one OFL Google Font with fallback is allowed. README must use only the supplied research/press evidence, label Tubefilter as press, avoid the unsourced “80%” claim, admit there is no evidence yet that lightweight presence improves retention, and include the exact required artwork sentence.

**Action:** Reserved the README work for milestone 4 and proposed locally vendored Space Grotesk plus licence as the sole non-code design asset.

## 2026-11-01 — Risk-first milestone order and Twitch setup

**Decided:** Prove the broadcaster token and real EventSub WebSocket tonight before domain or overlay work. Milestone 1 subscribes to `channel.chat.message`, `stream.online`, and `stream.offline`, starting from Twitch's Example Chatbot guide, and prints a real channel message. On boot, query `GET /streams` by broadcaster login to recover live state.

**Action:** Reordered the build. The broadcaster user token requests only `user:read:chat`; the stream query and online/offline subscriptions add no scopes. EventSub integration and diagnostics are now the first implementation.

## 2026-11-01 — Persistence, privacy, rendering, and demo

**Decided:** `events.jsonl` is the ledger and `state.json` is derived via `npm run rebuild`. Private receipt JSON may retain IDs; local receipt HTML shows names only. Reuse lamp drawing in receipt HTML. Use five silhouettes and seeded amber H20–50 / teal H170–195 / rose H335–355 at about 60/25/15, dark halos, reduced motion, lifetime-attendance size, and retained streak. Fade prior lamps .45/.30/.18; show at most 60 plus a counted cluster. Ignore broadcaster and common bots from config. Add adjustable `npm run demo` with a visible `DEMO REPLAY` tag; submission video remains real Twitch.

**Action:** Added these as explicit architecture, data, privacy, generator, overlay, configuration, and test requirements. Space Grotesk and its OFL licence are the only bundled asset, so README wording will say so accurately.

## 2026-11-01 — OAuth callback port

**Decided:** Use `http://localhost:3939` instead of port 3000 for the Twitch CLI OAuth callback because port 3000 is occupied. Nothing else changes.

**Action:** Updated `.env.example`; README setup will register 3939 as the first redirect URL and mint the token with `-p 3939`. This affects token creation only, not Lamplight's runtime server or OBS URL.

## 2026-11-02 — Real Twitch proof and Presence Receipts

**Decided:** The real-channel test must remain generic and brief, with VODs and clips disabled, and must prove a real `!lamp` from a second account before receipt work proceeds. Receipt JSON stays private and may contain Twitch user IDs; receipt HTML exposes names only and draws every attendee's deterministic lamp. The ledger, not `state.json`, remains authoritative.

**Action:** Confirmed the full `stream.online` → real `channel.chat.message` → visible OBS lamp → `stream.offline` path, then committed Milestone 3. Added automatic receipt sealing on `stream.offline`, a manual-finalize fallback, receipt hashing anchored to the verified event chain, a verification CLI, privacy tests, and HTML that reuses the repository's Canvas lamp module.

## 2026-11-02 — Locked lamp wall

**Decided:** Freeze the accepted five-lamp design and single-band composition. Bottom/top baselines are 88%/12%; lamps begin at x=80 with 150px full-size spacing and only ±12px seeded vertical jitter. Density tiers are full-size with labels through 12, collision-clamped 70% without labels through 30, and collision-clamped 50% through 60; further viewers become one counted cluster. Dim lamps are desaturated to 20% and use .45/.30/.20 opacity. Total glow is capped as density rises. Five silhouettes, three bases, four patterns, three frames, three finials, and three flames are seeded from user ID. No further visual changes unless something breaks.

**Action:** Implemented and tested the locked row, density/glow caps, exact 60-plus-cluster limit, compact/hide local controls, shared overlay/receipt generator, browser-only `?bg=1`, and generated 5/30/200 demos. The user approved the final 30- and 200-person OBS views.

## 2026-11-02 — Final colour lock

**Decided:** Lamp hue is continuous across the full wheel and remains seeded solely from user ID. Tone is seeded 50/50 pastel or deep, and flame colour is seeded as warm gold, soft white, or a low-saturation complement. Row placement may reorder identities by up to three positions locally, with a wider deterministic repair fallback, so adjacent hues differ by at least 45 degrees whenever mathematically possible. Lamp identity and the previously approved shape, row, density, glow, and dim-state geometry do not change.

**Action:** Replaced palette bands with deterministic continuous hue, tone, and flame colour; implemented circular hue-distance placement with explicit impossible-case logging; preserved the locked geometry; and added tests covering 500 rows of 30 plus the 1,000-ID tone/flame distribution. The user approved the final `?bg=1` preview and locked all visuals.

## 2026-11-02 — Human-readable receipt times

**Decided:** Receipt dates must be immediately understandable to a non-technical reader, while the exact source timestamps remain available for auditability.

**Action:** Added explicit Started, Ended, and Lit at labels; display timestamps in the viewer's local date/time format; and retain the exact UTC values in semantic `datetime` attributes and hover text. Receipt hashing and verification are unchanged.

**Decided:** The public HTML must not display credential-like identifiers that a viewer could mistake for Twitch user IDs or secrets.

**Action:** Removed the receipt-hash prefix from local HTML. The full receipt hash, Twitch user IDs, and source-event identifiers remain only in the gitignored local JSON used by the verifier; OAuth tokens and client secrets are never written to either receipt format.

## 2026-11-02 — Viewer-count sampling and declared-versus-verified receipt

**Decided:** While live, sample Twitch `GET /streams` immediately on live detection and every 60 seconds. Append each successful sample as its own hash-chained `lamplight.viewer.sample` event containing the stream ID, Twitch `viewer_count`, and the count of lamps lit at that exact moment. The receipt includes every sample, the peak of each series, and a plain-English comparison. A failed or stale API response is logged and skipped; it must never stop EventSub handling or write a misleading zero. Ledger writes are serialized so a timer and EventSub notification cannot fork the hash chain.

**Action:** Added the sampler, internal event, receipt comparison, HTML line, API parsing, concurrency guard, and tests for the 60-second live-only schedule, non-overlap, event shape, peaks, summary, verification, and privacy.

## 2026-11-02 — Closing moment

**Decided:** On `stream.offline`, show only the lamps lit in that stream and extinguish them in first-lit order at 150ms intervals. Then show `<total> lamps tonight, <returning> returning` for ten seconds and clear the entire band until the next stream begins. A returning lamp means it attended at least one earlier stream. The timestamped closing state may remain in the derived snapshot, but the overlay treats it as expired, so restart cannot replay an old closing. With reduced motion enabled, skip the sequence and show the summary immediately.

**Action:** Added derived closing state, stable-position extinguishing, the ten-second summary, clear-until-next-live behavior, reduced-motion handling, and deterministic timing/returning-count tests.

## 2026-11-02 — Repeat-emote flares

**Decided:** An already-lit viewer may flare only by posting exactly one emote and nothing else. Accepted flares have a per-user ten-second cooldown and create a separate hash-chained `lamplight.flare` event referencing the source chat message. Repeat commands, ordinary text, multiple fragments, broadcaster messages, and configured bots do not flare. The overlay pulses size and glow for 600ms and shows no count. Cooldown state is derived from the ledger and therefore survives restart. Reduced-motion mode uses a brief non-moving glow emphasis.

**Action:** Added flare eligibility, internal ledger events, cooldown-derived state, overlay pulse behavior, EventSub write ordering, and tests for message shape, cooldown, event linkage, duration, and absence of a displayed count.

## 2026-11-02 — Integration compatibility

**Decided:** Preserve receipts made before viewer sampling and preserve a single unbroken in-memory/file ledger after mid-stream recovery.

**Action:** Public rendering now gives legacy receipts an explicit no-samples comparison instead of failing, and boot recovery adds its event to the in-memory entry list immediately after appending it to disk. Updated the specification and setup documentation for sampling, closing, and flares.

## 2026-11-02 — Opening memory card

**Decided:** At `stream.online`, if a completed stream exists, show its ledger-backed attendance count for ten seconds before fading lamps in over one second. The returning count is the intersection of those prior attendees with viewers who relight during the current ten-second card, so it updates live. With no prior completed stream, show no card. This uses the same ledger facts that produce the prior receipt rather than storing a second copy.

**Action:** Added rebuildable opening-card state, live returning-count calculation, the ten-second card and one-second fade, plus tests for counts, no-history behavior, timing, and opacity.

## 2026-11-02 — Return greeting

**Decided:** For three seconds after a previously attended lamp relights, show `back for stream N` beneath its full-size name plate, where `N` is the ledger-derived lifetime stream count. First-time lamps, expired greetings, dense tiers without plates, and lamps not lit this stream show nothing.

**Action:** Added a deterministic greeting selector, overlay label, and tests for count, duration, and first-attendance exclusion.

## 2026-11-02 — Local roll call

**Decided:** Roll call is ephemeral localhost control state and never chat or ledger output. It cycles through uncalled lamps in first-lit order at four-second intervals. `Mark current lamp called` removes the highlighted lamp and advances immediately; after all lit lamps are called, the mode turns itself off. The current lamp grows 25% and receives a larger name plate even in dense tiers.

**Action:** Added roll-call controls, server-side called state, deterministic order/timing, overlay emphasis, automatic completion, and an order/completion test.

## 2026-11-02 — Streamer receipt search and attendance dots

**Decided:** Local receipt search matches display names case-insensitively and highlights the whole row and lamp. Every row shows exactly ten attendance dots, oldest on the left; when fewer than ten streams exist, unavailable earlier positions are empty. Dot values are derived while sealing from the ledger-backed completed/current stream IDs and lamp attendance, with no new runtime store.

**Action:** Added name search, row/lamp highlighting, ten-dot ledger-derived history, legacy fallback, and tests for the current-stream dot count and public controls.

## 2026-11-02 — Threshold wave

**Decided:** When the current stream first reaches `THRESHOLD_N` lit lamps, run one left-to-right wave with a 100ms stagger and roughly 300ms emphasis per lamp. It has no text, bar, count, or ledger event and cannot fire twice in one stream. `THRESHOLD_N` is a positive integer from `.env`, default 10; reduced-motion mode suppresses the wave.

**Action:** Added validated threshold configuration, one-shot per-stream tracking, overlay size/glow wave, and tests for threshold crossing, no repeat, new-stream reset, direction, and duration.

## 2026-11-02 — Removed GitHub Pages receipt export

**Decided:** The earlier GitHub Pages receipt export was removed before release. Receipts are local streamer records only.

**Action:** Removed the export CLI, package script, generated Pages artifacts, README link, and committed sample.

## 2026-11-02 — Overlay name visibility

**Decided:** `SHOW_NAMES=false` is a global overlay privacy switch: it hides ordinary plates, roll-call plates, and return greetings, while receipts retain names. Default is `true`; any value other than literal true/false fails configuration rather than guessing.

**Action:** Added validated configuration, server delivery, overlay enforcement, documentation, and parsing tests.

## 2026-11-02 — CJK-safe name plates

**Decided:** Preserve the locked plate geometry by fitting long labels inside a bounded width, reducing only font size to a 9px floor. After Space Grotesk, explicitly prefer macOS Japanese/Chinese system fonts (`Hiragino Sans`, `PingFang SC`) before general system fallbacks.

**Action:** Added shared plate-fitting metrics, explicit CJK fallbacks, overlay integration, and Japanese/Chinese tests asserting text remains within the plate bounds.

## 2026-11-02 — Neighbour welcome

**Decided:** For two seconds after a first-ever lamp lights, only its immediate rendered neighbours tilt four degrees toward it and receive a modest brightness/glow lift, then settle. It is overlay-only, selects the newest simultaneous newcomer, and is suppressed by reduced-motion mode.

**Action:** Added deterministic neighbour selection, directional effects, renderer tilt support, overlay integration, and adjacency/duration tests.

## 2026-11-02 — Flare ripple and spark

**Decided:** The latest flare gives its immediate rendered neighbours a one-third-strength pulse beginning 200ms later and lasting 600ms. If the two most recent distinct viewers flare within five seconds, draw a thin spark between their current lamp positions for 400ms. Both are overlay-only, reuse existing flare timestamps, and are suppressed by reduced-motion mode.

**Action:** Added deterministic ripple/spark derivation, overlay drawing, and tests for adjacency, delay, relative strength, distinct-viewer window, and duration.

## 2026-11-02 — Receipt company

**Decided:** Each receipt row lists up to three display names whose lamps share the most attended stream IDs with that viewer. Exclude self and zero-overlap lamps; rank by shared count descending then display name for deterministic ties. Store and expose display names only in the public row.

**Action:** Added ledger-derived co-attendance ranking, receipt rendering, legacy fallback, documentation, and ranking/cap tests.

## 2026-11-02 — Freeze scope and wave integration

**Decided:** Skip the red-thread section before the 17:00 freeze. It couples command/moderator authorization, pending and persistent graph state, caps, rebuilds, placement, receipts, waiting rendering, and eleven required tests; partial implementation would be unsafe for recording. Skip the entire constellation/firefly/milestone section because work began after its explicit 14:00 cutoff. If the threshold is reached during the ten-second opening card, defer the one-shot wave until the card clears rather than consuming it invisibly.

**Action:** Left all thread and fourth-section behavior absent and documented the scope decision. Moved threshold evaluation into the render cycle after opening-card state so the wave remains visible in the recording configuration.

## 2026-11-02 — Isolated red-thread model after freeze lift

**Decided:** Tag the recording-safe pre-thread build as `v0.2.0`. The full thread subsystem is gated by validated `THREADS`, default `false`. When false, no command processor runs, no internal thread event is appended, no thread receipt fields are added, and no thread placement or drawing occurs. Pending ties are live derived state only and expire on offline/restart; only mutual `lamplight.thread.tied` and accepted `lamplight.thread.untied` events enter the hash chain.

**Decided:** `!tie <display name>` is available only to a lit non-broadcaster/non-bot viewer, once per stream, targeting another lamp lit tonight. Resolve case-insensitive exact match first, then unique prefix. Reciprocal same-stream ties create a mutual thread; invalid, ambiguous, self, dim, absent, existing, or over-cap attempts do nothing. Persistent degree is capped at three per lamp in both validation and reducer, so the oldest three survive rebuild.

**Decided:** Because bare `!untie` is ambiguous with multiple persistent threads, a participant's bare command removes their thread only when exactly one exists; `!untie <display name>` targets a counterpart. Moderators use `!untie Name A | Name B` for an explicit pair, or one name only when that lamp has exactly one thread. Either party and moderators produce the same ledger untie event.

**Action:** Added gated parsing, pending and mutual state, reducer-enforced persistence/cap, rebuild behavior, participant/moderator untie, adjacency preference before hue separation, dashed/solid/waiting-knot rendering, reunion flares, display-name-only receipt pairs, and four ledger-derived night-summary lines. Added disabled-equivalence, mutuality, expiry, eligibility, one-outgoing, matching, untie, persistence, cap, waiting, placement, reunion, receipt, summary and privacy tests.

## 2026-11-02 — Recording fallback v0.3.0

**Decided:** Before lifting the freeze for the sky and wind, tag and push the complete red-thread build as `v0.3.0`. Both new behaviors must default off and must not leave a partial state if they fail verification.

**Action:** Tagged commit `1d03d6e` as `v0.3.0` and pushed the tag before changing code.

## 2026-11-02 — Ledger-derived constellation sky

**Decided:** With `SKY=true`, the first crossing of `THRESHOLD_N` in each stream earns exactly one of 72 non-duplicate zodiac fragments. Selection is seeded by stream ID: prefer an in-progress constellation 70% of the time when both paths exist, otherwise start an untouched constellation, then select a missing letter A–F. A fragment event records the stream, constellation, letter, and stable IDs of every lamp lit at that instant. The ledger is the sole source of sky state; after all 72, selection returns no award.

**Decided:** Use numeric positions selected from d3-celestial's permissively licensed constellation line data as real sky coordinates, then normalize them and generate Lamplight's own connected six-region line construction, visual hierarchy, and motion in code. No image or additional bundled visual asset is introduced. The panel stays top-right, uses low-opacity white, and the short earning animation remains above the lamp band before moving into the panel. Local receipt HTML translates earning-time IDs to display names.

**Action:** Added deterministic selection, internal hash-chained events, reducer/rebuild state, gated server processing, top-right panel/opening enlargement/earning and completion animation, receipt sky and summary data, privacy-safe HTML rendering, source documentation, and tests for determinism, weighting, uniqueness, once-per-stream, completion, rebuild, disabled behavior, and public privacy.

## 2026-11-02 — Collective flare wind

**Decided:** With `WIND=true`, five distinct viewers whose latest accepted flares fall within ten seconds trigger one shared flame lean lasting one second. Direction is deterministically derived from that flare set. A ten-second global cooldown prevents repeated gusts; the feature is overlay-only and reduced-motion mode suppresses it. With the flag false it is inert.

**Action:** Added an isolated browser-side wind tracker, shared flame shear, stream reset, cooldown, reduced-motion handling, configuration delivery, and tests for disabled state, distinct-viewer threshold, duration, and cooldown.

## 2026-11-02 — Sky preview and calm visual language

**Decided:** Provide `/sky-preview/` as a production-renderer review surface: all twelve constellations at receipt size, the same twelve at their actual tiny panel size, and Leo shown untouched, half collected, and complete. Use the same dark blue-to-charcoal preview gradient as the overlay's `?bg=1` mode. Names belong beneath preview/receipt glyphs and never inside the compact overlay panel.

**Decided:** The sky should feel quiet and precious rather than diagrammatic or neon: thin rounded lines, small soft stars with restrained seeded brightness variation, pale warm-white collected regions, barely visible cool dotted missing regions, and glow only after all six fragments complete a constellation.

**Action:** Exported the shared glyph renderer, applied the calm styling to preview, receipt, and overlay together, added the responsive preview grid and state comparison, registered the clean route, and added a route-level test.

## 2026-11-02 — Night-sky renderer pass

**Decided:** Change rendering only. Preserve every sky selection, fragment, ledger, rebuild, receipt-data, and threshold rule. Fit each constellation to roughly 70% of its card while preserving celestial aspect ratio. Use d3-celestial catalogue magnitudes to assign relative bright, mid, and faint tiers; only bright stars receive a soft radial glow and restrained four-point sparkle. Seed 20–30 faint background stars from the constellation name.

**Decided:** Untouched constellations show low-alpha stars and no lines. In-progress constellations show collected regions as rounded 1.5px pale warm-white lines with soft glow and missing regions as visible cool dotted lines. Complete constellations add a subtle whole-shape halo and warmer finish. Replace the unreadable twelve tiny drawings in the overlay panel with twelve status stars in an arc; only the current incomplete constellation gets a mini drawing and caption.

**Action:** Reworked only the shared canvas renderer and preview composition. Receipt rendering now includes the same seeded sky field, the overlay panel uses the status-star arc, and `/sky-preview/` retains receipt-size, panel, and Leo-state sections.

## 2026-11-02 — Band-contained occasion moments

**Decided:** Add no product state or viewer action. Render three moments exclusively from existing lamp and fragment timestamps. Ignite completes within one second: drop, small landing bounce, one wick bloom, and one sill ripple with a brief neighbouring-flame lean. Fragment earning stays entirely in the band/panel: one left-to-right underlight sweep, a 1.5× panel-region settle, and one pulse. A sixth fragment may use a fixed completion area above the row, capped at one third of frame height in normal mode and one half in big mode; stars reveal once along the drawing, the band flares once, and the drawing shrinks into the panel.

**Decided:** `MOMENTS=normal` is the validated default; `quiet` retains only the ignite ripple and panel effects, and `big` enlarges only the rare completion area. Never use frame-edge flashes or repeated flashes above two per second. Reduced-motion mode removes spatial movement in favour of brief low-intensity emphasis. Keep per-frame work bounded for the existing 60-lamp render cap.

**Action:** Added pure animation timelines, renderer integration, shared panel settling, arrival/ripple/neighbor effects, completion reveal/shrink, reduced-motion fallbacks, configuration validation, and tests for timing, level caps, quiet behavior, and defaults. Added `--moment ignite|fragment|complete` demo replays with current-time event shifting and a configurable start delay.

## 2026-11-02 — Ignite visibility correction

**Decided:** Preserve the shared real/replay trigger path through each lamp's reducer-derived `lastLitAt`; the replay was not bypassing moments. Make arrival unmistakable: begin 1.05 lamp-heights above the sill, use a 350ms ease-in fall, squash vertically by 7.5% on landing, rebound slightly, and start bloom/ripple at contact. Give every fresh lamp a temporary glow lift so seeded pastel/complement flame colours cannot read as dim during arrival.

**Action:** Re-timed and strengthened the ignite renderer, added base-anchored vertical squash support to the lamp renderer, increased the sill-ring and wick-bloom legibility, and added an integration test proving replayed and real chat events produce the same active ignite timestamp.

## 2026-11-02 — Stable slot before arrival

**Decided:** Resolve a new lamp's permanent hue-safe slot before it becomes visible. Preserve the existing row order across state packets. If insertion or a density-tier recomputation changes existing targets, ease those lamps horizontally and in size for 300ms, keep the newcomer hidden while the gap opens, then start its drop directly above the final slot. A lamp's x-position at landing must equal its steady-state x-position, and established lamps may slide but never jump.

**Action:** Added persistent row reconciliation, natural-slot-first hue insertion, frame-to-frame position/size interpolation, delayed arrival starts for gap opening, and tests for final-position landing, tier easing, forced insertion, and demo ordering. Changed the third moment-demo identity to a deterministic hue seed that lets Moments 1–3 remain left-to-right without weakening the colour rule.

## 2026-11-02 — Panel state fidelity

**Decided:** A sky moment may transition only between two real server states: the exact fragment array before the newest hash-chained event and the exact array after it. The panel, caption, and animated target must never calculate separate inventories or counts. After settling, the rendered count must equal the reducer state for every count from one through six.

**Action:** Replaced the panel's parallel base/animation inventories with one shared transition model used by all render paths. Extracted demo moment events into a testable generator; fragment demo now proves it grants only Leo A, while completion demo proves it replays Leo A–E before F. Added state-fidelity tests for previous/current arrays and every settled fragment count.

## 2026-11-02 — Unclipped completion handoff

**Decided:** Once a completed constellation begins shrinking toward the corner, render it on the unrestricted main canvas until it reaches the panel; the completion-area clip must not follow it in flight. The arrival target is the panel's real mini-glyph rectangle. The most recently progressed constellation remains the panel focus even when complete, so its six solid regions, `6 of 6` caption, and ringed arc star persist from server state. Give the panel one restrained 500ms pulse on arrival. Normal and big share the same handoff and settled state.

**Action:** Removed the completion travel clip, aligned its destination with the production panel geometry, extended the shared panel model with completed focus/ring state, added the post-arrival pulse, and added tests for persistent six-fragment focus, completion ring, and matching normal/big pulse timing.

## 2026-11-02 — Stream-scoped completion focus

**Decided:** Completion handoff must have no invisible frame: keep the travelling constellation on the unrestricted main canvas, continuously interpolate its centre and scale to the production panel glyph box, and crossfade into the panel rendering so travel alpha plus panel alpha remains one. After completion, lock that constellation as the panel's display focus for the rest of the stream and through offline. Release the display-only lock only when a different `stream.online` ID appears. The locked panel shows the full solid constellation, caption `<name>, complete`, and the ringed arc star. Apply the lock to quiet, normal, and big.

**Action:** Added complementary travel/panel crossfade values, an overlay display lock keyed by stream ID, completed-glyph captions, and tests proving continuous handoff, persistent complete focus through offline, and release on the next stream.

## 2026-11-02 — One-click local Twitch authorization

**Decided:** Use Twitch's server-side authorization-code flow with exact redirect `http://localhost:3939`, scope `user:read:chat`, a random expiring `state` value, and server-side code exchange. Store access/refresh tokens only in gitignored `data/auth.json` with owner-only permissions, refresh five minutes before expiry, rotate refresh tokens, and never put credentials in browser responses or logs. Preserve `TWITCH_ACCESS_TOKEN` as the unchanged fallback when no auth file exists.

**Decided:** The local overlay HTTP server must start before Twitch authentication so `/setup` remains reachable without a token. With neither stored nor env token, print only `open http://localhost:8787/setup to connect Twitch` and wait for the callback; after successful exchange, continue startup without a restart.

**Action:** Added the setup page and protected start/status routes, a localhost callback server, atomic token persistence and refresh scheduling, mutable live credentials for API calls, setup-first startup ordering, and tests for env fallback, CSRF state, code exchange, browser secrecy, local persistence, expiry refresh, and setup routes. Verified the implementation against Twitch's official authorization-code and refresh documentation.

## 2026-11-02 — Single Unicode emoji presence

**Decided:** Treat one Unicode emoji grapheme and nothing else as the same one-time-per-stream lamp trigger as one Twitch emote. Support joined emoji, skin tones, flags, variation selectors, and keycaps. Reject emoji plus text and multiple emoji. Do not broaden repeat-emote flares; this part changes presence only.

**Action:** Added a grapheme-aware Unicode property matcher to the existing presence predicate and tests for simple, modified, joined, flag, and heart emoji; text combinations, multiple emoji, and duplicate lights remain rejected.

## 2026-11-02 — Return promises

- Decision: `PROMISES` defaults on. A lit viewer may use `!back` once per stream; it is a no-pressure signal and cannot be undone.
- Implementation: each accepted promise is a `lamplight.promise.made` hash-chained ledger event. The next `stream.online` derives its eligible promise cohort from the immediately preceding completed stream; a normal lamp trigger marks a kept promise without extra viewer action.
- Decision: kept promises help the shared sky without exposing absences.
- Implementation: a kept lamp contributes one extra unit to the fragment threshold, receives a brief gold landing pulse, and increments its ledger-derived lifetime kept total. Aggregate counts and keeper names appear in the local streamer receipt; non-returner names never do.
- Decision: the closing invitation appears only near the channel's usual end or after the broadcaster types `!closing`.
- Implementation: usual duration is the median of completed stream durations rebuilt from the ledger. With no completed history the hint remains hidden unless `!closing` is received. The opening card is capped at three lines.

## 2026-11-02 — Thread commands, streaks, and stable placement

- Decision: accept `!tie @name` using Twitch mention fragments when present; bare `!tie` and `!untie` target the immediately previous lit viewer and do nothing without that neighbour.
- Implementation: mention text still has an exact-name/unique-prefix fallback. Existing mutuality, one-outgoing-per-stream, moderator removal, and three-thread cap remain enforced.
- Decision: count consecutive completed streams where both sides are present, reset on a missed stream, and restart at one on reunion.
- Implementation: total, current, and best counts rebuild from offline ledger events. Solid threads show streak two or higher; one-sided waiting threads are dashed and do not disclose who is absent. Local receipts project the just-ending stream into all three counts.
- Decision: thread adjacency may move at most two established lamps, at most once per five seconds, and never above thirty lamps; longer connections use arcs over no more than three intervening lamps.
- Implementation: arrivals are held for a 1.5-second display batch, the final order is computed once, existing lamps ease for 300ms, then arrivals drop in sequence. If a safe slide is unavailable the arrival remains appended; relationships spanning more than three lamps stay in the receipt but are not drawn.

## 2026-11-02 — Live local settings

- Decision: SKY, THREADS, WIND, PROMISES, SHOW_NAMES, MOMENTS, THRESHOLD_N, and LAYOUT belong on the localhost control page and apply without a restart.
- Implementation: validated settings are stored owner-only in gitignored `data/settings.json`. The server broadcasts each change immediately, and event handlers read the current values before accepting commands, awarding fragments, or sealing receipts.
- Decision: `.env` is for Twitch credentials and the local server port; old feature values may seed a first run but are not the ongoing source of truth.
- Implementation: `.env.example` now contains only the optional token, client id, client secret, channel login, and `PORT`. Built-in defaults remain safe when no legacy value or settings file exists.

## 2026-11-02 — Receipts remain local

- Decision: Presence Receipts are streamer records available only on the loopback-bound Lamplight server. Nothing about viewers is published.
- Implementation: removed the GitHub Pages receipt, committed sample, export command, and export code. Receipt JSON and HTML remain gitignored local files; `npm run verify` remains the integrity proof.
- Decision: do not retain chat text.
- Implementation: before hashing or writing a chat event, the ledger replaces its message with a boolean presence qualification and retains only the chatter identity fields required for deterministic rebuild and receipt verification. Thread, promise, and flare actions remain separate derived ledger events without chat text.

## 2026-11-02 — Four-step setup and roadmap

- Decision: the primary streamer path is exactly install, start, open `/setup` and click Connect Twitch, then paste one overlay URL into OBS. Everything else is optional.
- Implementation: rewrote setup around the authorization-code flow, reduced viewer instructions to one line, moved all controls and commands under optional features, and kept finalize, verify, rebuild, migration, and demos out of the required path.
- Decision: name four future directions without implying they exist today.
- Implementation: added viewer-owned Twitch-login records, `!me`, cross-channel threads, and a packaged one-click install under What's next. Font and constellation-data attribution remains unchanged.

## 2026-11-02 — Full-night replay priority

- Decision: the four-minute `--moment night` scenario runs every feature together with threshold three and normal moments. Ignite is immediate; fragment and completion moments are serialized; no sky moment is dropped; the panel advances with the corresponding moment.
- Implementation: the sixth-fragment sweep now finishes before the completion sequence starts 1.25 seconds later. Lamp arrivals and flares remain independent, so stacked events exercise the real overlay rather than pausing other state.
- Verification: reviewed 520 frames at 1920×1080, sampled every 500 ms. Per instruction, the early closing hint and a brief premature Leo-complete panel state are reported for a later fix rather than changed in this batch.

## 2026-11-02 — Night self-check fixes

- Decision: automatic closing invitations require a median of at least 30 minutes across the last five completed streams and appear at 90 percent of that median; `!closing` remains an immediate explicit override. Dense rows place the invitation above the sill end.
- Decision: a sky panel caption advances on the same queued moment transition as its drawing and may not expose the completed state before that moment starts.
- Implementation: demo replay now retimes `stream.online.started_at` together with its envelope timestamp, preventing compressed synthetic history from masquerading as multi-hour streams.
- Verification: all 103 tests and TypeScript checks passed. Repeated the 1920×1080 Playwright capture (520 frames, every 500 ms) into ignored `tmp/night/`, with canvas-text tracking. The hint first appears at frame 453 after explicit `!closing`, clear above the dense row (frame 460). Leo first renders complete at frame 397 during the completion transition, with no subsequent return to 5 of 6. Checked representative before/after frames visually; the two reported findings are resolved.

## 2026-11-02 — Slower night walkthrough and shorter cards

- Decision: add `--minutes` with four minutes as the default night timeline. Scale every interval evenly and print named notable events, including pending/mutual ties, promises, fragment progress, completion and the closing hint. Startup countdown and animation durations remain separate; `--speed` remains an alternative, not a simultaneous option. Real cooldown windows are unchanged.
- Decision: threads use warm red, 2px at full size and 1.5px at dense tiers, soft matching glow and brighter endpoints. Pending/waiting lines use 60% opacity; streak numbers use red on a dark pill. Arcs share the same style.
- Decision: opening cards have at most two short lines, attendance then kept promises only when nonzero. Remove waiting-thread and sky explanation text; the corner panel gives one soft pulse on opening, suppressed for reduced motion. Closing cards keep attendance, promise count and optional mutual-present thread count to two lines.
- Verification: 107 tests pass, TypeScript checks pass, and a 1920×1080 Chrome walkthrough produced no page errors. Inspected the opening, populated row and closing screenshots in ignored `tmp/small-fixes-*.png`; checked the named event output through the offline transition. No production dependency was added.

## 2026-11-02 — Adaptive sky threshold and landing progress

- Decision: default threshold mode is `auto`: take the median attendance of the last five completed streams, divide by 2.5, round, and floor at 3; no history gives 10. Include zero-attendance completed streams. For an even history count use the mean of the two middle values.
- Implementation: lock the chosen threshold in a hash-chained `lamplight.sky.threshold` event at stream start, rebuild it with the ledger, and retain it across restart. Setting changes apply next stream. Old active ledgers without a lock get one at startup. Existing numeric settings remain manual; the night demo and this machine's existing manual 3 remain intact.
- Decision: corner progress counts landed lamps, with two units and a fading +2 for kept promises. An earned fragment fills the bar, pulses softly once over 1.2 seconds, then resets; the existing one-fragment-per-stream rule is unchanged. Hide progress after this stream's constellation completion. Reduced motion uses a static full-bar hold, without the pulse or floating +2.
- Verification: 112 tests pass, including duplicate-online threshold preservation and ledger rebuild; build and secret scan pass. Checked the progress panel and completed-state hiding in Chrome at 1920×1080 with no page errors. A separate control-page check changed auto/manual settings and confirmed the current stream stayed at 3 while the next-stream setting changed. Real Twitch verification remains for the user's live test.

## 2026-11-03 — Reconnect Twitch feedback

- Decision: Reconnect explicitly reopens authorization and shows a short pressed state.
- Implementation: authorization requests include Twitch's documented force_verify=true and a fresh CSRF state. Setup displays Opening Twitch with 160ms pressed feedback before navigation; returning via browser history clears the busy state. Modified clicks retain native link behavior.
- Verification: targeted authorization, setup-page and overlay-server tests use fictional credentials and mocked environment loading. Callback tests use an ephemeral port to leave the running app untouched. No .env or real saved tokens accessed; live Twitch consent remains a user check.

## 2026-11-03 — Receipts from the control page

- Decision: put private receipt discovery at the top of the control page, newest completed stream first, with local date, lamp count, receipt link and a highlighted latest entry; show the current stream ID while live.
- Implementation: a localhost receipt-index route returns only stream metadata and lamp counts. The control page refreshes at stream end and every five seconds, uses safe text nodes, and indicates missing HTML pages rather than providing broken links. Receipts remain on the streamer's machine.
- Verification: build and targeted receipt-index/HTTP tests pass using synthetic fixtures. No .env or saved tokens accessed.

## 2026-11-03 — One local setup and control flow

- Decision: setup confirms Connected for one second then opens control; disconnected control visits return to setup. Control order is Connection, Receipts, Settings, Roll call. Keep demo controls available without a Twitch login.
- Implementation: connection status exposes only the configured channel name and connection boolean. Reconnect starts authorization directly. Receipt rows have date, lamps and an Open receipt button, with a live stream row and automatic refresh at stream end. Settings show Saved for one second only after server persistence acknowledgement.
- Verification: build and four targeted tests pass for redirects, connected channel metadata, section order, save acknowledgement and receipt listing. Tests use fictional state and do not read .env or saved tokens. README now directs users through setup once and then control.
