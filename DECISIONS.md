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
