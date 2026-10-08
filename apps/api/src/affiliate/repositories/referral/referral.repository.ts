import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { Affiliates } from "@src/affiliate/model-schemas";
import type { AffiliateDbOutput, AffiliateOutput } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["Referrals"];
export type ReferralInput = Partial<Table["$inferInsert"]>;
export type ReferralDbOutput = Table["$inferSelect"];
export type ReferralOutput = Omit<ReferralDbOutput, "createdAt"> & { createdAt: string };
export type ReferralWithAffiliate = { referral: ReferralOutput; affiliate: AffiliateOutput };

@singleton()
export class ReferralRepository extends BaseRepository<Table, ReferralInput, ReferralOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Referrals") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Referral", "Referrals");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new ReferralRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  /** `ON CONFLICT DO NOTHING` on the referred user's own unique constraint, so a second registration never overwrites who gets credit for the first. */
  async createIfAbsent(input: { referredUserId: string; affiliateId: string; trialCreditsCents?: number | null }): Promise<ReferralOutput | undefined> {
    const [row] = await this.cursor.insert(this.table).values(input).onConflictDoNothing({ target: this.table.referredUserId }).returning();
    return row ? this.toOutput(row) : undefined;
  }

  async findByReferredUserId(referredUserId: string): Promise<ReferralOutput | undefined> {
    return this.findOneBy({ referredUserId } as Partial<ReferralOutput>);
  }

  async findWithAffiliateByReferredUserId(referredUserId: string): Promise<ReferralWithAffiliate | undefined> {
    const [row] = await this.cursor
      .select({ referral: this.table, affiliate: Affiliates })
      .from(this.table)
      .innerJoin(Affiliates, eq(Affiliates.id, this.table.affiliateId))
      .where(eq(this.table.referredUserId, referredUserId))
      .limit(1);

    if (!row) return undefined;

    return { referral: this.toOutput(row.referral), affiliate: this.#toAffiliateOutput(row.affiliate) };
  }

  protected toOutput(payload: ReferralDbOutput): ReferralOutput {
    return {
      ...payload,
      createdAt: payload.createdAt.toISOString()
    };
  }

  #toAffiliateOutput(payload: AffiliateDbOutput): AffiliateOutput {
    return {
      ...payload,
      approvedAt: payload.approvedAt.toISOString(),
      revokedAt: payload.revokedAt ? payload.revokedAt.toISOString() : null,
      createdAt: payload.createdAt.toISOString(),
      updatedAt: payload.updatedAt.toISOString()
    };
  }
}
