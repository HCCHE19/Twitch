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

**Decided:** `events.jsonl` is the ledger and `state.json` is derived via `npm run rebuild`. Private receipt JSON may retain IDs; public receipt HTML and committed samples show names only. Reuse lamp drawing in receipt HTML. Use five silhouettes and seeded amber H20–50 / teal H170–195 / rose H335–355 at about 60/25/15, dark halos, reduced motion, lifetime-attendance size, and retained streak. Fade prior lamps .45/.30/.18; show at most 60 plus a counted cluster. Ignore broadcaster and common bots from config. Add adjustable `npm run demo` with a visible `DEMO REPLAY` tag; submission video remains real Twitch.

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

**Action:** Removed the receipt-hash prefix from public HTML and replaced it with `Public view · names only`. The full receipt hash, Twitch user IDs, and source-event identifiers remain only in the gitignored local JSON used by the verifier; OAuth tokens and client secrets are never written to either receipt format.

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

## 2026-11-02 — Viewer receipt search and attendance dots

**Decided:** Public receipt search matches display names case-insensitively and highlights the whole row and lamp without exposing IDs. Every row shows exactly ten attendance dots, oldest on the left; when fewer than ten streams exist, unavailable earlier positions are empty. Dot values are derived while sealing from the ledger-backed completed/current stream IDs and lamp attendance, with no new runtime store.

**Action:** Added name search, row/lamp highlighting, ten-dot ledger-derived history, legacy fallback, and tests for the current-stream dot count and public controls.

## 2026-11-02 — Threshold wave

**Decided:** When the current stream first reaches `THRESHOLD_N` lit lamps, run one left-to-right wave with a 100ms stagger and roughly 300ms emphasis per lamp. It has no text, bar, count, or ledger event and cannot fire twice in one stream. `THRESHOLD_N` is a positive integer from `.env`, default 10; reduced-motion mode suppresses the wave.

**Action:** Added validated threshold configuration, one-shot per-stream tracking, overlay size/glow wave, and tests for threshold crossing, no repeat, new-stream reset, direction, and duration.

## 2026-11-02 — GitHub Pages receipt export

**Decided:** `npm run export` produces a self-contained `docs/` site from the fictional public sample, production lamp renderer, Space Grotesk font, and OFL licence. Export rewrites root-relative asset paths for the `/Twitch/` project Pages location. The README links to the Pages URL while continuing to label the committed receipt as fictional sample data.

**Action:** Added the export CLI, package script, generated Pages artifacts, README link, and an export-output validation step.

## 2026-11-02 — Overlay name visibility

**Decided:** `SHOW_NAMES=false` is a global overlay privacy switch: it hides ordinary plates, roll-call plates, and return greetings, while receipts retain names. Default is `true`; any value other than literal true/false fails configuration rather than guessing.

**Action:** Added validated configuration, server delivery, overlay enforcement, documentation, and parsing tests.

## 2026-11-02 — CJK-safe name plates

**Decided:** Preserve the locked plate geometry by fitting long labels inside a bounded width, reducing only font size to a 9px floor. After Space Grotesk, explicitly prefer macOS Japanese/Chinese system fonts (`Hiragino Sans`, `PingFang SC`) before general system fallbacks.

**Action:** Added shared plate-fitting metrics, explicit CJK fallbacks, overlay integration, and Japanese/Chinese tests asserting text remains within the plate bounds.
