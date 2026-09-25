import { like } from "drizzle-orm";

import { IndexerState } from "@src/db/schema";
import type { ReplayableModule } from "@src/pipeline/modules";
import { moduleOfReplayStream, REPLAY_STREAM_PATTERN } from "@src/pipeline/modules";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";

/** Modules whose `replay:<module>` marker exists, i.e. whose rows a replay currently owns. */
export async function readModulesUnderReplay(executor: ChainDatabase | ChainTransaction): Promise<ReplayableModule[]> {
  const rows = await executor.select().from(IndexerState).where(like(IndexerState.stream, REPLAY_STREAM_PATTERN));
  return rows
    .map(row => moduleOfReplayStream(row.stream))
    .filter((module): module is ReplayableModule => module !== null)
    .sort();
}
