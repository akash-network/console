import { and, asc, count, eq, gt, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["DataKeys"];
export type DataKeyInput = Table["$inferInsert"];
export type DataKeyOutput = Table["$inferSelect"];

@singleton()
export class DataKeyRepository extends BaseRepository<Table, DataKeyInput, DataKeyOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("DataKeys") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "DataKey", "DataKeys");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new DataKeyRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByUserId(userId: DataKeyOutput["userId"]): Promise<DataKeyOutput | undefined> {
    return this.findOneBy({ userId });
  }

  /**
   * Claims the user's single data key slot. The unique constraint decides the winner, and the loser
   * discards its own wrapped key to re-read the winner's row — retrying its insert would leave the
   * user with two keys and half their values unreadable under each.
   */
  async createUnlessExists(input: Pick<DataKeyInput, "userId" | "wrappedKey" | "wrappedByKid">): Promise<{ dataKey: DataKeyOutput; isNew: boolean }> {
    const [created] = await this.cursor.insert(this.table).values(input).onConflictDoNothing({ target: [this.table.userId] }).returning();

    if (created) {
      return { dataKey: this.toOutput(created), isNew: true };
    }

    const winner = await this.findByUserId(input.userId);

    if (!winner) {
      throw new Error(`Data key not found after unique conflict resolution. userId: ${input.userId}`);
    }

    return { dataKey: winner, isNew: false };
  }

  /** Answers whether a KMS key version may still be destroyed without making stored data keys unrecoverable. */
  async countWrappedUnder(wrappedByKid: DataKeyOutput["wrappedByKid"]): Promise<number> {
    return this.count({ wrappedByKid });
  }

  /** Where the fleet stands across every version at once, so an operator reads what is left behind without asking version by version. */
  async countByWrappingVersion(): Promise<Record<string, number>> {
    const rows = await this.cursor
      .select({ wrappedByKid: this.table.wrappedByKid, total: count() })
      .from(this.table)
      .groupBy(this.table.wrappedByKid)
      .orderBy(asc(this.table.wrappedByKid));

    return Object.fromEntries(rows.map(row => [row.wrappedByKid, row.total]));
  }

  /**
   * Keyset rather than offset, because every committed batch removes its own rows from this
   * predicate: an offset walked forward over the shrinking remainder would step over as many rows
   * as it moved. A row this run cannot move keeps its wrapping, so it is read again on the next
   * pass — which is the whole of the rotation's resumability.
   */
  async *findNotWrappedUnderIteratively({ wrappedByKid, batchSize }: { wrappedByKid: string; batchSize: number }): AsyncGenerator<DataKeyOutput[]> {
    let cursor: string | undefined;

    while (true) {
      const batch = await this.cursor
        .select()
        .from(this.table)
        .where(and(ne(this.table.wrappedByKid, wrappedByKid), ...(cursor ? [gt(this.table.id, cursor)] : [])))
        .orderBy(asc(this.table.id))
        .limit(batchSize);

      if (!batch.length) return;

      yield this.toOutputList(batch);

      if (batch.length < batchSize) return;

      cursor = batch[batch.length - 1].id;
    }
  }

  /**
   * The wrapping this re-wrap opened is compared inside the statement's own WHERE, so a row another
   * writer moved first is left as that writer wrote it rather than overwritten with a key wrapped
   * from a reading that is no longer current.
   */
  async rewrapIfStillWrappedUnder(input: { id: string; wrappedUnder: string; wrappedKey: string; wrappedByKid: string }): Promise<boolean> {
    const [rewrapped] = await this.cursor
      .update(this.table)
      .set({ wrappedKey: input.wrappedKey, wrappedByKid: input.wrappedByKid, updatedAt: sql`now()` })
      .where(and(eq(this.table.id, input.id), eq(this.table.wrappedByKid, input.wrappedUnder)))
      .returning({ id: this.table.id });

    return !!rewrapped;
  }
}
