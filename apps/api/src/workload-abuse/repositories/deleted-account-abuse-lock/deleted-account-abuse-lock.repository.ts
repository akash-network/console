import { eq, or, type SQL } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["DeletedAccountAbuseLocks"];
export type DeletedAccountAbuseLockInput = Partial<Table["$inferInsert"]>;
export type DeletedAccountAbuseLockOutput = Table["$inferSelect"];

export interface AccountHashes {
  identityHash: string | null;
  emailHash: string | null;
}

@singleton()
export class DeletedAccountAbuseLockRepository extends BaseRepository<Table, DeletedAccountAbuseLockInput, DeletedAccountAbuseLockOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("DeletedAccountAbuseLocks") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "DeletedAccountAbuseLock", "DeletedAccountAbuseLocks");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new DeletedAccountAbuseLockRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Returns nothing without a hash to match, since a query with no condition would match every row. */
  async findByAnyHash({ identityHash, emailHash }: AccountHashes): Promise<DeletedAccountAbuseLockOutput | undefined> {
    const matches: SQL[] = [];
    if (identityHash) matches.push(eq(this.table.identityHash, identityHash));
    if (emailHash) matches.push(eq(this.table.emailHash, emailHash));

    if (matches.length === 0) return undefined;

    return await this.cursor.query.DeletedAccountAbuseLocks.findFirst({ where: this.whereAccessibleBy(or(...matches)) });
  }
}
