import postgres from "postgres";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { TxService } from "@src/core/services/tx/tx.service";

const POLL_INTERVAL_MS = 20;

/** Watches from a connection of its own, since the operations it watches may hold every connection of the app's pool. */
export async function waitForLockWait(statementPattern: string, { timeoutMs = 10_000 }: { timeoutMs?: number } = {}): Promise<void> {
  const observer = postgres(container.resolve(CORE_CONFIG).POSTGRES_DB_URI, { max: 1 });
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      const waiting =
        await observer`select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike ${statementPattern}`;

      if (waiting.length) return;

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`No statement like "${statementPattern}" waited on a lock within ${timeoutMs} ms`);
  } finally {
    await observer.end();
  }
}

/** Keeps the transaction `work` ran in open until `release` is called, so a test can race another operation against the locks it took. */
export function holdTransaction(work: () => Promise<void>) {
  let release!: () => void;
  let markHeld!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  const isHeld = new Promise<void>(resolve => (markHeld = resolve));

  const committed = container.resolve(TxService).transaction(async () => {
    await work();
    markHeld();
    await released;
  });

  return { held: Promise.race([isHeld, committed]), release, committed };
}
