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
}
