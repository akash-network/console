import { and, asc, gt, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["DataKeys"];
export type DataKeyInput = Table["$inferInsert"];
export type DataKeyOutput = Table["$inferSelect"];

/** How many data keys one KMS key version still holds, which is what gates destroying that version. */
export type DataKeyWrappingCount = {
  wrappedByKid: DataKeyOutput["wrappedByKid"];
  count: number;
};

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

  /** The same question asked of every version at once, so a rotation can report which versions are still in use without knowing what to ask about. */
  async countByWrappingVersion(): Promise<DataKeyWrappingCount[]> {
    return await this.cursor
      .select({ wrappedByKid: this.table.wrappedByKid, count: sql<number>`count(*)::int` })
      .from(this.table)
      .groupBy(this.table.wrappedByKid)
      .orderBy(asc(this.table.wrappedByKid));
  }

  /**
   * Keyset-paged on `id`, and filtered on the version rather than on a progress marker, so a
   * re-wrap that stopped halfway resumes by selection alone: a row it already moved no longer
   * matches. Read outside any transaction, because the caller commits each batch in one of its own.
   */
  async *findWrappedUnderOtherVersionsIteratively({
    targetKid,
    batchSize
  }: {
    targetKid: DataKeyOutput["wrappedByKid"];
    batchSize: number;
  }): AsyncGenerator<DataKeyOutput[]> {
    let cursor: DataKeyOutput["id"] | undefined;

    while (true) {
      const batch = await this.pg
        .select()
        .from(this.table)
        .where(and(ne(this.table.wrappedByKid, targetKid), ...(cursor ? [gt(this.table.id, cursor)] : [])))
        .orderBy(asc(this.table.id))
        .limit(batchSize);

      if (!batch.length) {
        return;
      }

      yield this.toOutputList(batch);

      if (batch.length < batchSize) {
        return;
      }

      cursor = batch[batch.length - 1].id;
    }
  }
}
