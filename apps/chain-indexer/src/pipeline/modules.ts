/** The writer groups a backfill stream can replay on their own; `core` (blocks, transactions, messages) is what every module derives from and is never replayed this way. */
export const REPLAYABLE_MODULES = ["balance", "gov", "akash", "provider", "bme"] as const;

export type ReplayableModule = (typeof REPLAYABLE_MODULES)[number];

const REPLAY_STREAM_PREFIX = "replay:";

/** The `indexer_state` stream of a module replay: its checkpoint while it runs, and the marker that tells live sync to leave the module to the replay. */
export function replayStream(module: ReplayableModule): string {
  return `${REPLAY_STREAM_PREFIX}${module}`;
}

export function moduleOfReplayStream(stream: string): ReplayableModule | null {
  if (!stream.startsWith(REPLAY_STREAM_PREFIX)) {
    return null;
  }
  const module = stream.slice(REPLAY_STREAM_PREFIX.length);
  return (REPLAYABLE_MODULES as readonly string[]).includes(module) ? (module as ReplayableModule) : null;
}

export const REPLAY_STREAM_PATTERN = `${REPLAY_STREAM_PREFIX}%`;

/** Arbitrary but fixed application-wide key that serializes a module replay's start and handoff against every full commit; distinct from the migration and audit-signature locks. */
export const REPLAY_HANDOFF_LOCK_KEY = 7_431_002;
