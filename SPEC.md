# Lamplight specification

## Outcome and boundaries

Lamplight is a local Node service plus one OBS browser source. A viewer lights their persistent, procedurally drawn lamp by sending exactly one emote and nothing else, `!lamp`, or `!lurk`. The overlay—not a chat bot—acknowledges them. At stream end, Lamplight seals a verifiable Presence Receipt from the received Twitch EventSub events. It is attendance, not a recap: no ranking, scores, summaries, clips, runtime AI, Twitch Extension, chat output, or third-party visual/audio assets.

Core success: on the broadcaster's real channel, an eligible chat message visibly changes the correct deterministic lamp from dim to bright; restarting the service preserves it; ending a stream produces a receipt that `npm run verify` accepts.

## Architecture

One TypeScript process serves static overlay files over HTTP, hosts a local WebSocket for overlay state, connects as a client to Twitch EventSub WebSocket, and persists append-only JSON Lines plus small JSON snapshots. No database or web framework. Twitch events are deduplicated by EventSub `message_id` because delivery is at least once. The service handles welcome/keepalive/reconnect/revocation, subscribes after each fresh connection, and never sends on Twitch's socket except a protocol Pong if requested. The OBS URL is `http://localhost:8787/overlay/`.

Flow: Twitch EventSub -> validate/dedupe -> append canonical event with `prevHash` and SHA-256 `hash` -> rebuild derived state -> apply presence rule -> broadcast state/delta -> Canvas 2D overlay. `events.jsonl` is the ledger; `state.json` is a rebuildable snapshot. On boot, `GET /helix/streams?user_login=...` restores live status/start time after a mid-stream restart. While live, the same endpoint is sampled immediately and every 60 seconds; each successful `viewer_count` plus the simultaneous lit-lamp count becomes a hash-chained internal event. A user-ID-seeded PRNG controls five silhouettes, three bases, four glass patterns, three frames, three finials, three flame styles, ±6° tilt, continuous hue across 0–360°, a 50/50 pastel-or-deep tone, and one of three flame colours (warm gold, soft white, or a low-saturation complement). Adjacent lamps are reordered, never recoloured, so their circular hue distance is at least 45° whenever possible. The locked overlay is one top or bottom band: baseline at 12%/88%, first centre 80px from the left, full-size spacing 150px, and only ±12px seeded vertical jitter. Up to 12 lamps are full-size with labels; 13–30 use a collision-clamped 70% tier without labels; 31–60 use a collision-clamped 50% tier; overflow becomes one counted cluster, so no more than 61 objects render. Glow energy falls with density. Dim lamps retain outlines, use 20% saturation, and fade .45/.30/.20. A faint warm 40px sill anchors the row. Every lamp has a soft dark halo and motion respects `prefers-reduced-motion`. Display name is only a label. Brightness reflects this stream; size grows by a small capped function of lifetime attended streams and never shrinks. An already-lit viewer's exact single-emote message creates a logged 600ms flare with a per-user ten-second cooldown. On `stream.offline`, lit lamps extinguish in first-lit order at 150ms intervals, a total/returning line remains for ten seconds, then the band clears until the next stream. The receipt records stream bounds, qualifying presences, streaks, minute samples and peaks, source event IDs/times, event count, chain anchors, and receipt hash. Verification recomputes the chain and receipt. Receipt HTML reuses the exact generated lamp design without exposing user IDs.

## File tree

```text
src/{server,twitch,event-log,presence,store,types}.ts
public/{overlay,receipt}/{index.html,*.css,*.js}
config/ignored-users.json
test/{fixtures,*.test.ts}
data/{events.jsonl,state.json}  receipts/ # generated; ignored except .gitkeep
scripts/verify-secrets.sh
SPEC.md  DECISIONS.md  README.md  .env.example  package.json  tsconfig.json
```

## Runtime, dependencies, and Twitch contract

- Node >=20: HTTP, filesystem, Web Crypto/`crypto`, testable process/CLI primitives; no packages for built-in jobs.
- TypeScript + `@types/node`: strict types and safer EventSub/data boundaries; compiled by `tsc`.
- `ws` + `@types/ws`: Twitch WebSocket client and OBS state WebSocket server; the only runtime package.
- Vitest: fast unit/integration tests with fixtures. Plain HTML/CSS/JS and Canvas 2D avoid a frontend framework/build chain.
- One locally vendored Google Font under the OFL (proposed: Space Grotesk) with system sans-serif fallback; the font file and licence are the sole non-code design asset.

Token: a Twitch **user access token** minted for the broadcaster/app, stored only in `.env`, with minimum scope `user:read:chat`. For WebSocket subscriptions Twitch requires a user token; for `channel.chat.message` its condition uses `broadcaster_user_id=<channel>` and `user_id=<token owner>`. Twitch references used in code comments: https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ and https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-chat-message.

Required EventSub subscriptions: `channel.chat.message` v1 (`user:read:chat`), `stream.online` v1 (no added scope), and `stream.offline` v1 (no added scope). Optional, disabled and untested: `channel.follow` v2 with `moderator:read:followers` for a follower ring; `channel.channel_points_custom_reward_redemption.add` v1 with `channel:read:redemptions`. References: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-follow and https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-channel-points-custom-reward-redemption-add. No write-chat scope.

Qualifying chat is case-insensitive trimmed `!lamp`/`!lurk`, or a message whose fragments contain exactly one `emote` fragment and no non-whitespace text/other fragments. The broadcaster and configured bots (`nightbot`, `streamelements`, `streamlabs`, `fossabot`, `moobot`, `sery_bot`) are ignored. The Twitch payload documents `message.text` and `message.fragments`; real custom/global emote fixtures must confirm this rule before claiming support.

## Data model

`LampState`: `userId`, latest `login`/`displayName`, deterministic seed inputs, `firstSeenAt`, `lastLitAt`, `lastStreamId`, `streamsSinceLit`, `attendedStreamIds[]`, `streak`, `lifetimeLights`. `StreamState`: Twitch stream ID/start and first-lit-order user IDs. `ClosingMoment`: offline timestamp, lit order, total and returning counts. `LogEvent`: schema version, EventSub or internal message ID/type/time, selected payload fields, `receivedAt`, `prevHash`, `hash`; internal types include viewer samples and accepted flares. `PresenceReceipt`: stream metadata, ordered presence rows, minute samples, viewer/lamp peaks, comparison sentence, chain anchors/count, sealed time, receipt hash. Tokens and raw authorization headers are never logged. Private receipt JSON may contain user IDs and remains ignored; receipt HTML and committed samples contain display names only and use consented or fictional names.

## Milestones, stop loss, and tests

1. Real Twitch first: from Twitch's Example Chatbot guide, validate the token, resolve broadcaster identity/live state, connect to EventSub WebSocket, subscribe to chat/online/offline, and print one real channel message. Connection tests; secret scan; commit.
2. Deterministic domain and local simulation: ledger/rebuild, presence rules, five-silhouette Canvas generator, demo replay, persistence/restart. Unit tests; commit.
3. OBS overlay and real light: HTTP/local WebSocket, adaptive layout, real `!lamp` visibly lights its lamp in OBS. Visual and integration tests; commit.
4. Receipts/docs: online/offline lifecycle, finalize fallback, JSON/HTML receipts reusing lamp drawing, verify CLI, setup/troubleshooting, evidence-backed README. Tests and clean-clone setup check; commit.
5. Polish only if core is proven: new/returning ring (follower ring only if authorized), threshold wave, roll call. Never jeopardize recording; commit separately.

**Stop loss:** at 12:00 Sydney time on Nov 2, if a real chat message has not lit a lamp, immediately remove single-emote detection and all optional features; ship only `!lamp`, persistent lamp, receipt, verify, and setup. If `stream.offline` is unreliable during testing, use `npm run finalize` and mark the source in the receipt. If live EventSub is blocked, retain fixture demo only for diagnosis, but do not call the product submission-ready.

Tests: deterministic lamp seed/same ID and separation across sample IDs; exactly five silhouettes; rendered-signature collision under 2% across 1,000 IDs; 200 IDs cover at least four silhouettes and all flame colours; 1,000 IDs produce a roughly even tone split and all three flame colours; 500 rows of 30 have at least 45° hue distance between neighbours unless impossible; one-row geometry, density collision caps, 60-plus-cluster limit, halo and reduced-motion behavior; exact command/emote eligibility, ignored broadcaster/bots, and rejections; flare eligibility, ledger linkage, ten-second cooldown and 600ms pulse; closing order, 150ms timing, returning count, ten-second summary and clear state; 60-second live-only sampling, non-overlap, sample shape, peaks, comparison and legacy-receipt fallback; event dedupe; canonical hash-chain creation, tamper detection, truncation/anchor failure; `npm run rebuild` reproduces state solely from the ledger; streak reset after a missed completed stream; lifetime-size cap/non-shrink; historical opacity at .45/.30/.20 floor; restart/live-query recovery; stream transitions; receipt contents/hash/verification and HTML privacy; malformed EventSub; welcome/subscription requests; keepalive timeout, reconnect handover, connection-loss resubscribe, revocation surfaced; demo replay adjustable speed/tag and real handlers; overlay snapshot/delta; HTTP/WS smoke; generated files excluded; `.env` absent and token-pattern scan passes. Manual: OBS transparency/readability at 1080p, real account/friend messages, restart recovery, two or three short streams, no chat output, no external visual/audio requests.

## Assumptions and questions

Assumptions: the app is single-channel and runs locally on the OBS Mac; broadcaster ID and token-owner ID are the same; Node 20+, OBS, Twitch CLI and a registered Twitch app are available; localhost is acceptable as the one OBS URL and a second private localhost tab may control compact/hide; the service runs before/during each test stream; streak means consecutive completed streams attended, resets to zero after one miss, and the next light makes it one; a user can light only once per stream; historical opacity is .45 one stream ago, .30 two ago, and .20 at three or more; only 60 individual lamps render and older overflow becomes one counted cluster lamp; user ID is stable identity and names may change; receipt integrity is tamper-evidence, not third-party attestation; hard WebSocket outages cannot be replayed by Twitch; system clock is reasonably correct; optional features may be omitted; deadline is Nov 3 06:30 Australia/Sydney and stop loss Nov 2 12:00; vendored Space Grotesk plus OFL is the only bundled asset; public repo excludes real `data/` and `.env`; `npm run demo -- --speed <factor> <file>` or `npm run demo -- --lamps <count>` replays Twitch-shaped events through production handlers and visibly labels the overlay `DEMO REPLAY`; `?bg=1` is browser-preview-only; real Twitch, never demo, is used in the submission video.
