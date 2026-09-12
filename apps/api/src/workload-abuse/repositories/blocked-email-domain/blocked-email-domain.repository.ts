import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["BlockedEmailDomains"];
export type BlockedEmailDomainInput = Partial<Table["$inferInsert"]>;
export type BlockedEmailDomainOutput = Table["$inferSelect"];

export interface AutoBlockInput {
  domain: string;
  reason: string;
  triggeredByUserId: string;
}

@singleton()
export class BlockedEmailDomainRepository extends BaseRepository<Table, BlockedEmailDomainInput, BlockedEmailDomainOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("BlockedEmailDomains") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "BlockedEmailDomain", "BlockedEmailDomains");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new BlockedEmailDomainRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByDomain(domain: string): Promise<BlockedEmailDomainOutput | undefined> {
    return await this.cursor.query.BlockedEmailDomains.findFirst({ where: eq(this.table.domain, domain) });
  }

  /**
   * Returns a row only to the call whose insert created it, so the unique index — not a race-prone
   * read-before-write — decides the winner, and a domain an operator has already ruled on keeps their row.
   */
  async blockIfAbsent(input: AutoBlockInput): Promise<BlockedEmailDomainOutput | undefined> {
    const [inserted] = await this.cursor
      .insert(this.table)
      .values({ ...input, status: "blocked", source: "auto" })
      .onConflictDoNothing({ target: this.table.domain })
      .returning();

    return inserted;
  }
}
