import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { expect, vi } from "vitest";

export async function untilAQueryWaitsOnALock(db: NodePgDatabase<Record<string, unknown>>): Promise<void> {
  await vi.waitFor(
    async () => {
      const { rows } = await db.execute<{ waiting: number }>(
        sql`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`
      );
      expect(rows[0].waiting).toBeGreaterThan(0);
    },
    { timeout: 5_000, interval: 20 }
  );
}
