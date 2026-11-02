import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export async function receiptIndex(directory = "receipts") {
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const rows = await Promise.all(files.filter(file => /^[a-zA-Z0-9_-]+\.json$/u.test(file)).map(async file => {
    try {
      const receipt = JSON.parse(await readFile(join(directory, file), "utf8"));
      if (!receipt.stream?.endedAt || !Number.isFinite(Date.parse(receipt.stream.startedAt)) || !Number.isFinite(Date.parse(receipt.stream.endedAt)) || !Array.isArray(receipt.presence)) return null;
      const html = file.replace(/\.json$/u, ".html");
      const available = await stat(join(directory, html)).then(info => info.isFile(), () => false);
      return { streamId: String(receipt.stream.id), startedAt: receipt.stream.startedAt as string, endedAt: receipt.stream.endedAt as string, lampCount: receipt.presence.length, url: available ? `/receipts/${encodeURIComponent(html)}` : null };
    } catch { return null; } // A partial receipt write is retried on the next refresh.
  }));
  return rows.filter(row => row !== null).sort((a,b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || b.streamId.localeCompare(a.streamId));
}
