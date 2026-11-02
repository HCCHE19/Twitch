import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "./canonical.js";
import { verifyLedger } from "./ledger.js";
import { generateLamp } from "./lamp-generator.js";
import type { DerivedState, LedgerEntry, PresenceReceipt, PresenceReceiptRow, ViewerSample } from "./types.js";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const escapeHtml = (value: string): string => value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export function sharedCompany(userId: string, lamps: DerivedState["lamps"]): string[] {
  const lamp = lamps[userId];
  if (!lamp) return [];
  const attended = new Set(lamp.attendedStreamIds);
  return Object.values(lamps).filter((candidate) => candidate.userId !== userId).map((candidate) => ({
    name: candidate.displayName,
    shared: candidate.attendedStreamIds.filter((streamId) => attended.has(streamId)).length
  })).filter((candidate) => candidate.shared > 0).sort((left, right) => right.shared - left.shared || left.name.localeCompare(right.name)).slice(0, 3).map((candidate) => candidate.name);
}

export function createReceipt(state: DerivedState, entries: LedgerEntry[], endedAt: string, finalization: "eventsub" | "manual" = "eventsub", sealedAt = new Date().toISOString(), threadsEnabled = false, skyEnabled = false): PresenceReceipt {
  const stream = state.currentStream;
  if (!stream) throw new Error("No live stream to finalize");
  verifyLedger(entries);
  const start = entries.findIndex((entry) => {
    const event = entry.payload.event as Record<string, unknown> | undefined;
    return (entry.subscriptionType === "stream.online" || entry.subscriptionType === "lamplight.stream.recovered") && String(event?.id ?? "") === stream.id;
  });
  if (start < 0) throw new Error(`Stream ${stream.id} has no ledger start event`);
  const slice = entries.slice(start);
  const recentStreamIds = [...state.completedStreamIds, stream.id].slice(-10);
  const rows: PresenceReceiptRow[] = stream.litUserIds.map((userId) => {
    const lamp = state.lamps[userId];
    if (!lamp) throw new Error(`Missing lamp state for ${userId}`);
    const source = slice.find((entry) => entry.subscriptionType === "channel.chat.message" && String((entry.payload.event as Record<string, unknown> | undefined)?.chatter_user_id ?? "") === userId);
    if (!source) throw new Error(`Missing source message for ${lamp.displayName}`);
    const recentAttendance = [...Array<boolean>(10 - recentStreamIds.length).fill(false), ...recentStreamIds.map((streamId) => lamp.attendedStreamIds.includes(streamId))];
    return { userId, displayName: lamp.displayName, firstSeenAt: lamp.firstSeenAt, litAt: lamp.lastLitAt, streak: lamp.streak, lifetimeStreams: lamp.attendedStreamIds.length, sourceMessageId: source.messageId, recentAttendance, company: sharedCompany(userId, state.lamps) };
  }).sort((left, right) => left.litAt.localeCompare(right.litAt));
  const samples: ViewerSample[] = slice.filter((entry) => entry.subscriptionType === "lamplight.viewer.sample").flatMap((entry) => {
    const event = entry.payload.event as Record<string, unknown> | undefined;
    if (String(event?.stream_id ?? "") !== stream.id) return [];
    const twitchViewers = Number(event?.viewer_count);
    const litLamps = Number(event?.lit_lamps);
    if (!Number.isFinite(twitchViewers) || !Number.isFinite(litLamps)) return [];
    return [{ sampledAt: entry.messageTimestamp, twitchViewers, litLamps }];
  });
  const peakTwitchViewers = Math.max(0, ...samples.map((sample) => sample.twitchViewers));
  const peakLitLamps = Math.max(0, ...samples.map((sample) => sample.litLamps));
  const summary = samples.length
    ? `Twitch reported ${peakTwitchViewers} viewer${peakTwitchViewers === 1 ? "" : "s"} at peak; ${peakLitLamps} lit a lamp.`
    : "No viewer-count samples were available for this stream.";
  const tiedEvents = threadsEnabled ? slice.filter((entry) => entry.subscriptionType === "lamplight.thread.tied").filter((entry) => String((entry.payload.event as Record<string, unknown> | undefined)?.stream_id ?? "") === stream.id) : [];
  const threadsTonight = tiedEvents.flatMap((entry) => {
    const event = entry.payload.event as Record<string, unknown> | undefined;
    const left = state.lamps[String(event?.user_id_a ?? "")]?.displayName;
    const right = state.lamps[String(event?.user_id_b ?? "")]?.displayName;
    return left && right ? [[left, right] as [string, string]] : [];
  });
  const longest = [...rows].sort((left, right) => right.streak - left.streak || left.litAt.localeCompare(right.litAt))[0];
  const nightSummary = {
    firstLitAt: rows[0]?.litAt ?? null,
    lastLitAt: rows.at(-1)?.litAt ?? null,
    firstArrival: rows[0]?.displayName ?? null,
    longestStreakName: longest?.displayName ?? null,
    longestStreak: longest?.streak ?? 0,
    threadsTied: threadsTonight.length
  };
  const earnedFragment = skyEnabled ? state.skyFragments.find((item) => item.streamId === stream.id) ?? null : null;
  const sky = skyEnabled ? {
    collected: state.skyFragments.map(({ constellation, fragment }) => ({ constellation, fragment })),
    tonight: earnedFragment ? {
      constellation: earnedFragment.constellation,
      fragment: earnedFragment.fragment,
      stars: earnedFragment.litUserIds.flatMap((userId) => state.lamps[userId]?.displayName ? [state.lamps[userId]!.displayName] : [])
    } : null
  } : undefined;
  const withoutHash = {
    schemaVersion: 1 as const,
    stream: { id: stream.id, startedAt: stream.startedAt, endedAt, finalization },
    presence: rows,
    attendance: { samples, peakTwitchViewers, peakLitLamps, summary },
    ...(threadsEnabled ? { threadsTonight } : {}),
    ...(threadsEnabled || skyEnabled ? { nightSummary: { ...nightSummary, ...(skyEnabled ? { fragment: earnedFragment ? `${earnedFragment.constellation} ${earnedFragment.fragment}` : null } : {}) } } : {}),
    ...(skyEnabled && sky ? { sky } : {}),
    ledger: { startPrevHash: entries[start]!.prevHash, endHash: entries.at(-1)?.hash ?? "", eventCount: slice.length },
    sealedAt
  };
  return { ...withoutHash, receiptHash: sha256(canonicalJson(withoutHash)) };
}

export function verifyReceipt(receipt: PresenceReceipt, entries: LedgerEntry[]): void {
  verifyLedger(entries);
  const { receiptHash, ...withoutHash } = receipt;
  if (sha256(canonicalJson(withoutHash)) !== receiptHash) throw new Error("Receipt hash mismatch");
  const start = entries.findIndex((entry) => entry.prevHash === receipt.ledger.startPrevHash);
  if (start < 0) throw new Error("Receipt start anchor not found");
  const end = entries.findIndex((entry, index) => index >= start && entry.hash === receipt.ledger.endHash);
  if (end < 0) throw new Error("Receipt end anchor not found");
  if (end - start + 1 !== receipt.ledger.eventCount) throw new Error("Receipt event count mismatch");
  const startEvent = entries[start]!.payload.event as Record<string, unknown> | undefined;
  if (String(startEvent?.id ?? "") !== receipt.stream.id) throw new Error("Receipt stream does not match start event");
  for (const row of receipt.presence) {
    const source = entries.slice(start, end + 1).find((entry) => entry.messageId === row.sourceMessageId);
    if (!source || source.subscriptionType !== "channel.chat.message") throw new Error(`Source event missing for ${row.displayName}`);
    const event = source.payload.event as Record<string, unknown> | undefined;
    if (String(event?.chatter_user_id ?? "") !== row.userId) throw new Error(`Source identity mismatch for ${row.displayName}`);
    if (source.messageTimestamp !== row.litAt) throw new Error(`Source time mismatch for ${row.displayName}`);
  }
}

export function receiptHtml(receipt: PresenceReceipt): string {
  const attendance = receipt.attendance ?? { samples: [], peakTwitchViewers: 0, peakLitLamps: 0, summary: "No viewer-count samples were available for this stream." };
  const publicRows = receipt.presence.map((row) => ({ displayName: row.displayName, litAt: row.litAt, streak: row.streak, lifetimeStreams: row.lifetimeStreams, recentAttendance: row.recentAttendance ?? Array<boolean>(10).fill(false), company: row.company ?? [], lampDesign: generateLamp(row.userId) }));
  const localTime = (value: string): string => `<time class="local-time" datetime="${escapeHtml(value)}" title="${escapeHtml(value)}">${escapeHtml(value)}</time>`;
  const cards = publicRows.map((row, index) => `<article data-index="${index}" data-name="${escapeHtml(row.displayName.toLocaleLowerCase())}"><canvas width="180" height="180" data-index="${index}"></canvas><div><h2>${escapeHtml(row.displayName)}</h2><p>Streak ${row.streak} · ${row.lifetimeStreams} stream${row.lifetimeStreams === 1 ? "" : "s"} attended</p>${row.company.length ? `<p class="company">Often here with ${row.company.map(escapeHtml).join(", ")}</p>` : ""}<div class="dots" aria-label="Attendance over the last ten streams">${row.recentAttendance.map((attended) => `<span class="dot${attended ? " filled" : ""}"></span>`).join("")}</div><p class="lit-time">Lit at ${localTime(row.litAt)}</p></div></article>`).join("\n");
  const comparison = escapeHtml(attendance.summary);
  const threadSection = receipt.nightSummary ? `<section class="comparison">${receipt.threadsTonight ? `<strong>Threads tonight</strong><p>${receipt.threadsTonight.length ? receipt.threadsTonight.map(([left, right]) => `${escapeHtml(left)} — ${escapeHtml(right)}`).join(" · ") : "None"}</p>` : `<strong>Night summary</strong>`}<p>Lamps were lit ${receipt.nightSummary.firstLitAt ? `from ${localTime(receipt.nightSummary.firstLitAt)} until ${localTime(receipt.nightSummary.lastLitAt!)}` : "at no recorded time"}.</p><p>First to arrive: ${escapeHtml(receipt.nightSummary.firstArrival ?? "None")}.</p><p>Longest streak tonight: ${escapeHtml(receipt.nightSummary.longestStreakName ?? "None")} (${receipt.nightSummary.longestStreak}).</p>${receipt.threadsTonight ? `<p>Threads tied tonight: ${receipt.nightSummary.threadsTied}.</p>` : ""}${Object.hasOwn(receipt.nightSummary,"fragment") ? `<p>Fragment tonight: ${escapeHtml(receipt.nightSummary.fragment ?? "None")}.</p>` : ""}</section>` : "";
  const skySection = receipt.sky ? `<section class="sky"><canvas id="sky-map" width="720" height="240"></canvas><h2>Tonight's fragment</h2><p>${receipt.sky.tonight ? `${escapeHtml(receipt.sky.tonight.constellation)} ${escapeHtml(receipt.sky.tonight.fragment)} · stars of this fragment: ${receipt.sky.tonight.stars.map(escapeHtml).join(", ") || "none"}` : "No fragment earned tonight."}</p></section>` : "";
  const skyImport = receipt.sky ? "import{drawReceiptSky}from'/shared/sky.js';" : "";
  const skyRuntime = receipt.sky ? `const sky=${JSON.stringify(receipt.sky).replace(/</gu, "\\u003c")};drawReceiptSky(document.querySelector('#sky-map'),sky.collected);` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Presence Receipt</title><style>@font-face{font-family:Space;src:url(/fonts/SpaceGrotesk-wght.woff2)}*{box-sizing:border-box}body{margin:0;background:#071014;color:#f5e9cf;font:16px Space,system-ui,sans-serif;padding:48px}main{max-width:820px;margin:auto}header{border-bottom:1px solid #294048;padding-bottom:24px}h1{margin:0 0 12px;color:#ffc56f}.stream-time{display:grid;grid-template-columns:max-content 1fr;gap:5px 12px;margin:10px 0 14px}.stream-time span{color:#b8cbc9}.comparison,.sky{margin:18px 0;padding:14px 16px;border:1px solid #294048;border-radius:10px;background:#0b181d}.sky #sky-map{width:100%;height:220px}.comparison strong{display:block;color:#b8cbc9;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.comparison p{margin-top:7px}.search{width:100%;padding:12px 14px;border:1px solid #294048;border-radius:9px;background:#0b181d;color:#f5e9cf;font:inherit}article{display:flex;align-items:center;gap:22px;border-bottom:1px solid #182c32;padding:14px 0;transition:opacity .15s,background .15s}article.dimmed{opacity:.28}article.match{background:rgba(102,216,204,.08)}article canvas{width:120px;height:120px}h2,p{margin:4px 0}.dots{display:flex;gap:5px;margin:10px 0}.dot{width:8px;height:8px;border:1px solid #66807e;border-radius:50%}.dot.filled{border-color:#ffc56f;background:#ffc56f}time,.seal,.lit-time{color:#8eaaa9;font-size:13px}</style></head><body><main><header><h1>Presence Receipt</h1><div class="stream-time"><span>Started</span>${localTime(receipt.stream.startedAt)}<span>Ended</span>${localTime(receipt.stream.endedAt)}</div><p class="seal">${receipt.presence.length} present · sealed ${localTime(receipt.sealedAt)} · Public view · names only</p></header><section class="comparison"><strong>Declared versus verified presence</strong><p>${comparison}</p></section>${threadSection}${skySection}<input class="search" type="search" placeholder="Find your lamp" aria-label="Find your lamp">${cards || "<p>No presences recorded.</p>"}</main><script type="module">import{drawLampDesign}from'/shared/lamp.js';${skyImport}const rows=${JSON.stringify(publicRows).replace(/</gu, "\\u003c")};${skyRuntime}const formatter=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});document.querySelectorAll('.local-time').forEach((element)=>{const date=new Date(element.dateTime);if(!Number.isNaN(date.valueOf()))element.textContent=formatter.format(date)});document.querySelectorAll('article canvas').forEach((canvas)=>{const row=rows[Number(canvas.dataset.index)];const context=canvas.getContext('2d');context.scale(1.5,1.5);drawLampDesign(context,row.lampDesign,60,92,100,1,0)});document.querySelector('.search').addEventListener('input',(event)=>{const query=event.target.value.trim().toLocaleLowerCase();document.querySelectorAll('article').forEach((article)=>{const match=query&&article.dataset.name.includes(query);article.classList.toggle('match',Boolean(match));article.classList.toggle('dimmed',Boolean(query)&&!match)})});</script></body></html>`;
}

export async function writeReceiptFiles(receipt: PresenceReceipt, directory = "receipts"): Promise<{ jsonPath: string; htmlPath: string }> {
  await mkdir(directory, { recursive: true });
  const safeId = receipt.stream.id.replace(/[^a-zA-Z0-9_-]/gu, "-");
  const jsonPath = join(directory, `${safeId}.json`);
  const htmlPath = join(directory, `${safeId}.html`);
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(htmlPath, receiptHtml(receipt), { encoding: "utf8", mode: 0o600 });
  return { jsonPath, htmlPath };
}

export async function readReceipt(path: string): Promise<PresenceReceipt> {
  return JSON.parse(await readFile(path, "utf8")) as PresenceReceipt;
}
