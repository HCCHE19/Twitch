export interface EventSubEnvelope {
  metadata: {
    message_id: string;
    message_type: string;
    message_timestamp: string;
    subscription_type?: string;
  };
  payload: {
    event?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface LedgerEntry {
  schemaVersion: 1;
  messageId: string;
  messageType: string;
  subscriptionType?: string;
  messageTimestamp: string;
  receivedAt: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface LampState {
  userId: string;
  login: string;
  displayName: string;
  firstSeenAt: string;
  lastLitAt: string;
  lastStreamId: string;
  streamsSinceLit: number;
  attendedStreamIds: string[];
  streak: number;
  lifetimeLights: number;
}

export interface StreamState {
  id: string;
  startedAt: string;
  litUserIds: string[];
}

export interface ClosingMoment {
  startedAt: string;
  litUserIds: string[];
  totalLamps: number;
  returningLamps: number;
}

export interface DerivedState {
  schemaVersion: 1;
  lastHash: string;
  processedMessageIds: string[];
  currentStream: StreamState | null;
  closingMoment: ClosingMoment | null;
  completedStreamIds: string[];
  lamps: Record<string, LampState>;
  demoReplay: boolean;
}

export interface PresenceReceiptRow {
  userId: string;
  displayName: string;
  firstSeenAt: string;
  litAt: string;
  streak: number;
  lifetimeStreams: number;
  sourceMessageId: string;
}

export interface ViewerSample {
  sampledAt: string;
  twitchViewers: number;
  litLamps: number;
}

export interface AttendanceComparison {
  samples: ViewerSample[];
  peakTwitchViewers: number;
  peakLitLamps: number;
  summary: string;
}

export interface PresenceReceipt {
  schemaVersion: 1;
  stream: { id: string; startedAt: string; endedAt: string; finalization: "eventsub" | "manual" };
  presence: PresenceReceiptRow[];
  attendance: AttendanceComparison;
  ledger: { startPrevHash: string; endHash: string; eventCount: number };
  sealedAt: string;
  receiptHash: string;
}
