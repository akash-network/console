import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["Affiliates"];
export type AffiliateInput = Partial<Table["$inferInsert"]>;
export type AffiliateDbOutput = Table["$inferSelect"];
export type AffiliateOutput = Omit<AffiliateDbOutput, "approvedAt" | "revokedAt" | "createdAt" | "updatedAt"> & {
  approvedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@singleton()
export class AffiliateRepository extends BaseRepository<Table, AffiliateInput, AffiliateOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Affiliates") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Affiliate", "Affiliates");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new AffiliateRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByCode(code: string): Promise<AffiliateOutput | undefined> {
    return this.findOneBy({ code } as Partial<AffiliateOutput>);
  }

  async findByUserId(userId: string): Promise<AffiliateOutput | undefined> {
    return this.findOneBy({ userId } as Partial<AffiliateOutput>);
  }

  protected toOutput(payload: AffiliateDbOutput): AffiliateOutput {
    return {
      ...payload,
      approvedAt: payload.approvedAt.toISOString(),
      revokedAt: payload.revokedAt ? payload.revokedAt.toISOString() : null,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString()
    };
  }
}
