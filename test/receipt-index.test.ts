import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { receiptIndex } from "../src/receipt-index.js";

it("lists completed receipts newest first with counts and existing page links only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "receipt-index-"));
  try {
    for (const [id, day, count] of [["older", "01", 2], ["latest", "02", 3]] as const) {
      await writeFile(join(directory, `${id}.json`), JSON.stringify({ stream: { id, startedAt: `2026-11-${day}T10:00:00Z`, endedAt: `2026-11-${day}T11:00:00Z` }, presence: Array(count).fill({ userId: "private-id", displayName: "Fictional" }) }));
    }
    await writeFile(join(directory,"latest.html"), "receipt");
    await writeFile(join(directory,"broken.json"), "{");
    const rows=await receiptIndex(directory);
    expect(rows.map(row=>row.streamId)).toEqual(["latest","older"]);
    expect(rows[0]).toMatchObject({lampCount:3,url:"/receipts/latest.html"});
    expect(rows[1]?.url).toBeNull();
    expect(JSON.stringify(rows)).not.toContain("private-id");
    expect(await receiptIndex(join(directory,"absent"))).toEqual([]);
  } finally { await rm(directory,{recursive:true}); }
});
