import { and, desc, eq, gte, lt, or, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { AccountHashes } from "@src/workload-abuse/lib/account-hashes/account-hashes";

type Table = ApiPgTables["DeletedTrialAccounts"];
export type DeletedTrialAccountInput = Partial<Table["$inferInsert"]>;
export type DeletedTrialAccountOutput = Table["$inferSelect"];

@singleton()
export class DeletedTrialAccountRepository extends BaseRepository<Table, DeletedTrialAccountInput, DeletedTrialAccountOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("DeletedTrialAccounts") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "DeletedTrialAccount", "DeletedTrialAccounts");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new DeletedTrialAccountRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** Returns nothing without a hash to match, since a query with no condition would match every row. */
  async findByAnyHashSince({ identityHash, emailHash }: AccountHashes, since: Date): Promise<DeletedTrialAccountOutput[]> {
    const matches: SQL[] = [];
    if (identityHash) matches.push(eq(this.table.identityHash, identityHash));
    if (emailHash) matches.push(eq(this.table.emailHash, emailHash));

    if (matches.length === 0) return [];

    return await this.cursor.query.DeletedTrialAccounts.findMany({
      where: this.whereAccessibleBy(and(or(...matches), gte(this.table.createdAt, since))),
      orderBy: [desc(this.table.createdAt)]
    });
  }

  /** Re-checks the refused account in SQL, so two activations of one account running together raise a single review. */
  async markRefusedOnce(id: DeletedTrialAccountOutput["id"], refusedUserId: string): Promise<boolean> {
    const [marked] = await this.cursor
      .update(this.table)
      .set({ refusedUserId })
      .where(this.whereAccessibleBy(and(eq(this.table.id, id), sql`${this.table.refusedUserId} is distinct from ${refusedUserId}::uuid`)))
      .returning({ id: this.table.id });

    return !!marked;
  }

  async deleteOlderThan(cutoff: Date): Promise<void> {
    await this.cursor.delete(this.table).where(this.whereAccessibleBy(lt(this.table.createdAt, cutoff)));
  }
}
