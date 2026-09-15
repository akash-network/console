import { and, asc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { assertBatchSize } from "@src/core/lib/batch-size/batch-size";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["DataKeys"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

  /** The key new values are sealed under; a retired key is reached only through the id a stored value names. */
  async findByUserId(userId: DataKeyOutput["userId"]): Promise<DataKeyOutput | undefined> {
    return this.findOneBy({ userId, retiredAt: null });
  }

  /** Any of the user's keys, retired or not, so a value sealed before a re-key still opens; a header is untrusted input, so an id that is not a uuid is a miss rather than a query error. */
  async findOwnedById(userId: DataKeyOutput["userId"], id: DataKeyOutput["id"]): Promise<DataKeyOutput | undefined> {
    if (!UUID_PATTERN.test(id)) return undefined;

    return this.findOneBy({ id, userId });
  }

  /** The keys a re-key retired for the user and has not deleted yet, oldest first; more than one means two runs were each interrupted. */
  async findRetiredByUserId(userId: DataKeyOutput["userId"]): Promise<DataKeyOutput[]> {
    const rows = await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.userId, userId), isNotNull(this.table.retiredAt)))
      .orderBy(asc(this.table.retiredAt));

    return this.toOutputList(rows);
  }

  /** Guards on the row still being active, so two re-keys racing over one user retire it once and the loser learns it lost. */
  async retireIfActive(id: DataKeyOutput["id"]): Promise<DataKeyOutput | undefined> {
    return await this.updateBy({ id, retiredAt: null }, { retiredAt: new Date() }, { returning: true });
  }

  /** Deletes only a retired row, so no caller can remove the key new values are being sealed under. */
  async deleteRetired(id: DataKeyOutput["id"]): Promise<boolean> {
    const [deleted] = await this.cursor
      .delete(this.table)
      .where(and(eq(this.table.id, id), isNotNull(this.table.retiredAt)))
      .returning({ id: this.table.id });

    return deleted !== undefined;
  }

  /**
   * Claims the user's single active data key slot. The partial unique index decides the winner, and the loser
   * discards its own wrapped key to re-read the winner's row — retrying its insert would leave the
   * user with two active keys and half their values unreadable under each.
   */
  async createUnlessExists(input: Pick<DataKeyInput, "userId" | "wrappedKey" | "wrappedByKid">): Promise<{ dataKey: DataKeyOutput; isNew: boolean }> {
    const [created] = await this.cursor
      .insert(this.table)
      .values(input)
      .onConflictDoNothing({ target: [this.table.userId], where: isNull(this.table.retiredAt) })
      .returning();

    if (created) {
      return { dataKey: this.toOutput(created), isNew: true };
    }

    const winner = await this.findByUserId(input.userId);

    if (!winner) {
      throw new Error(`Data key not found after unique conflict resolution. userId: ${input.userId}`);
    }

    return { dataKey: winner, isNew: false };
  }

  /** Guards the write on the wrapping the caller opened, so a row another writer moved in between is left to that writer. */
  async rewrapIfStillWrappedUnder(
    id: DataKeyOutput["id"],
    wrappedByKid: DataKeyOutput["wrappedByKid"],
    rewrapped: Pick<DataKeyInput, "wrappedKey" | "wrappedByKid">
  ): Promise<boolean> {
    const row = await this.updateBy({ id, wrappedByKid }, rewrapped, { returning: true });

    return row !== undefined;
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

  /** Filters on the version rather than a progress marker so an interrupted run resumes by selection alone; ids are random uuids, so one pass may skip a row inserted mid-scan and only the destroy-time count vouches for completeness. */
  async *findWrappedUnderOtherVersionsIteratively({
    targetKid,
    batchSize
  }: {
    targetKid: DataKeyOutput["wrappedByKid"];
    batchSize: number;
  }): AsyncGenerator<DataKeyOutput[]> {
    assertBatchSize(batchSize);

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
