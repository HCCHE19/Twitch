import type { EventSubEnvelope } from "./types.js";

export function viewerSampleEnvelope(streamId: string, viewerCount: number, litLamps: number, sampledAt = new Date().toISOString()): EventSubEnvelope {
  return {
    metadata: {
      message_id: `viewer-sample:${streamId}:${sampledAt}`,
      message_type: "internal",
      message_timestamp: sampledAt,
      subscription_type: "lamplight.viewer.sample"
    },
    payload: { event: { stream_id: streamId, viewer_count: viewerCount, lit_lamps: litLamps } }
  };
}

export function startViewerSampler(
  isLive: () => boolean,
  sample: () => Promise<void>,
  intervalMs = 60_000
): { trigger: () => Promise<void>; stop: () => void } {
  let running = false;
  const trigger = async (): Promise<void> => {
    if (!isLive() || running) return;
    running = true;
    try { await sample(); }
    finally { running = false; }
  };
  const timer = setInterval(() => void trigger(), intervalMs);
  timer.unref?.();
  return { trigger, stop: () => clearInterval(timer) };
}
