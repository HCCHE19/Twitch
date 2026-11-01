import { afterEach, describe, expect, it, vi } from "vitest";
import { startViewerSampler, viewerSampleEnvelope } from "../src/viewer-sampling.js";

afterEach(() => vi.useRealTimers());

describe("viewer count sampling", () => {
  it("creates a Twitch-shaped internal ledger event", () => {
    expect(viewerSampleEnvelope("stream-1", 12, 9, "2026-11-01T10:01:00Z")).toMatchObject({
      metadata: { subscription_type: "lamplight.viewer.sample", message_timestamp: "2026-11-01T10:01:00Z" },
      payload: { event: { stream_id: "stream-1", viewer_count: 12, lit_lamps: 9 } }
    });
  });

  it("runs every 60 seconds only while live and prevents overlapping requests", async () => {
    vi.useFakeTimers();
    let live = true;
    let release: (() => void) | undefined;
    const sample = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const sampler = startViewerSampler(() => live, sample);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sample).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sample).toHaveBeenCalledTimes(1);
    release?.();
    await Promise.resolve();
    live = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sample).toHaveBeenCalledTimes(1);
    sampler.stop();
  });
});
