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
  lifetimePromisesKept: number;
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
  promisedLamps: number;
}

export interface ThreadState {
  userIds: [string, string];
  createdAt: string;
  createdStreamId: string;
}

export interface PendingThread {
  fromUserId: string;
  toUserId: string;
  createdAt: string;
}

export interface OpeningCard {
  startedAt: string;
  previousStreamId: string;
  previousUserIds: string[];
  previousPromiseUserIds: string[];
}

export interface PromiseRecord {
  streamId: string;
  userId: string;
  madeAt: string;
}

export interface SkyFragment {
  streamId: string;
  constellation: string;
  fragment: string;
  earnedAt: string;
  litUserIds: string[];
}

export interface DerivedState {
  schemaVersion: 1;
  lastHash: string;
  processedMessageIds: string[];
  currentStream: StreamState | null;
  closingMoment: ClosingMoment | null;
  openingCard: OpeningCard | null;
  flareAtByUserId: Record<string, string>;
  threadReunionAtByUserId: Record<string, string>;
  threads: ThreadState[];
  pendingThreads: PendingThread[];
  threadOutgoingUserIds: string[];
  skyFragments: SkyFragment[];
  promises: PromiseRecord[];
  promiseAtByUserId: Record<string, string>;
  promiseKeptUserIds: string[];
  promiseKeptAtByUserId: Record<string, string>;
  closingHintAt: string | null;
  completedStreamDurationsMs: number[];
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
  recentAttendance: boolean[];
  company: string[];
  lifetimePromisesKept?: number;
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
  threadsTonight?: Array<[string, string]>;
  nightSummary?: {
    firstLitAt: string | null;
    lastLitAt: string | null;
    firstArrival: string | null;
    longestStreakName: string | null;
    longestStreak: number;
    threadsTied: number;
    fragment?: string | null;
  };
  sky?: {
    collected: Array<{ constellation: string; fragment: string }>;
    tonight: { constellation: string; fragment: string; stars: string[] } | null;
  };
  promises?: {
    promisedTonight: number;
    promisedLastStream: number;
    kept: number;
    keptNames: string[];
  };
  ledger: { startPrevHash: string; endHash: string; eventCount: number };
  sealedAt: string;
  receiptHash: string;
}
