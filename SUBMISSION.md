# Lamplight submission kit

## English description

Most viewers never type, so a small streamer can see a viewer count while the room still feels empty. Lamplight gives a silent viewer one low-pressure action: send `!lamp`, `!lurk`, or one emote by itself. Their persistent, procedurally generated lamp brightens on the OBS overlay. The same person always receives the same lamp; returning across consecutive streams increases their streak, while lifetime attendance gently grows the lamp without rankings or competition.

Once lit, a viewer can send one emote again to create a brief cooldown-limited flare without adding a score or count. While live, Lamplight records Twitch's reported viewer count once per minute beside the number of lamps lit at that moment. At stream end, the lamps extinguish in attendance order and Lamplight seals a Presence Receipt from the Twitch EventSub events it actually received. The receipt declares both peaks without claiming they measure the same thing. The append-only event log is hash-chained, the state snapshot can be rebuilt from that ledger, and a verification command detects tampering. Lamplight uses no runtime AI and never speaks in chat. Setup is one localhost browser source in OBS.

## Video plan — target 2:35

Use only the Lamplight overlay, Twitch, OBS, Terminal, and this repository. No music, outside images, game footage, camera, or microphone input other than your narration.

1. **0:00–0:20 — Problem.** Show an empty, generic OBS scene. Say: “Most viewers never type. For a small streamer, two viewers and an empty chat can feel like nobody is there.”
2. **0:20–0:40 — Product.** Show the bottom-left persistent dim lamp. Say: “Lamplight gives a silent viewer one action to say ‘I’m here,’ without a leaderboard or a bot demanding attention.”
3. **0:40–1:15 — Real Twitch proof.** Start a short real stream. From the second account send `!lamp`. Show the lamp brighten and the display name appear. Say: “This is a real Twitch EventSub chat message, not the demo replay.”
4. **1:15–1:35 — Persistence.** Briefly restart the local service or explain the prior lamp is loaded from the rebuilt state. Say: “The event log is the ledger; the snapshot is derived from it.”
5. **1:35–2:00 — Closing and receipt.** Stop the stream, show the lamps extinguish and the closing line, then show the generated name-only receipt with its Twitch-viewer-versus-lit-lamp comparison.
6. **2:00–2:15 — Verification.** Run `npm run verify -- receipts/<stream-id>.json` and show `valid receipt`.
7. **2:15–2:35 — Codex workflow and close.** Show `SPEC.md`, `DECISIONS.md`, tests passing, and the git milestone commits. Say: “I made the product decisions and tested it on my channel. Codex turned the specification into the EventSub client, deterministic canvas art, ledger, receipts, tests, and documentation in this single session.”

## Recording checklist

- Replace `<stream-id>` before recording the verify command.
- Hide `.env`, tokens, Twitch Client ID, real private receipt JSON, notifications, bookmarks, and unrelated browser tabs.
- Use the fictional sample receipt or consented names only when showing HTML publicly.
- Confirm microphone input, but disable desktop audio so no outside music is captured.
- Keep VODs and clips disabled for temporary test broadcasts.
- Record at 1080p and keep the final export under three minutes.
- Show `DEMO REPLAY` only when explicitly explaining development mode; the product proof must use real Twitch.
- Add the Codex session ID from `/status` to the submission form; do not place access tokens in the form or repository.

## Final form checklist

- Public repository URL
- YouTube URL, public or unlisted, under three minutes
- English description above, adjusted only for length
- Codex session ID from `/status`
- README setup checked from a clean clone
- Repository contains no `.env`, real `data/`, video, audio, Twitch emotes, logos, or outside imagery
