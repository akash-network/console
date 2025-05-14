import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { valueBackoff } from "@src/lib/value-backoff/value-backoff";
import * as schema from "../../model-schemas";

@Injectable()
export class BlockCursorRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  private readonly id = "latest";

  async getNextBlockForProcessing<T>(cb: (block: number) => Promise<T>): Promise<T> {
    return await this.db.transaction(async transaction => {
      const prevBlock = await valueBackoff(
        async () => {
          const cursor = await transaction
            .select({ height: schema.BlockCursor.lastProcessedBlock })
            .from(schema.BlockCursor)
            .where(eq(schema.BlockCursor.id, this.id))
            .for("update", { skipLocked: true })
            .limit(1);

          return cursor[0]?.height;
        },
        {
          maxDelay: 5_000,
          startingDelay: 500,
          timeMultiple: 2,
          numOfAttempts: 5,
          jitter: "none",
          createError: () => new Error("Block Cursor lookup failed")
        }
      );

      const nextBlock = prevBlock + 1;

      const cbResult = await cb(nextBlock);

      await transaction.update(schema.BlockCursor).set({ lastProcessedBlock: nextBlock, updatedAt: new Date() }).where(eq(schema.BlockCursor.id, this.id));

      return cbResult;
    });
  }

  async ensureInitialized(height: number): Promise<void> {
    await this.db.insert(schema.BlockCursor).values({ id: this.id, lastProcessedBlock: height }).onConflictDoNothing();
  }
}
