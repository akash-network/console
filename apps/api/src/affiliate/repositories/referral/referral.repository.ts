import { and, count, countDistinct, desc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { Affiliates } from "@src/affiliate/model-schemas";
import type { AffiliateDbOutput, AffiliateOutput } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { StripeTransactions, UserWallets } from "@src/billing/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

const PAYING_PAYMENT_STATUSES = ["succeeded", "refunded"] as const;
const EARNED_COMMISSION_STATUSES = ["pending", "succeeded", "refunded"] as const;

const ReferredPayments = alias(StripeTransactions, "referred_payment");
const ReferredPaymentOrganizations = alias(Organizations, "referred_payment_organization");
const ReferralCommissions = alias(StripeTransactions, "referral_commission");

export type ReferralSummary = {
  id: string;
  createdAt: Date;
  hasPaid: boolean;
  paidCents: number;
  earnedCents: number;
  wallet: { isTrialing: boolean; activatedAt: Date | null; createdAt: Date } | null;
};

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

  async countByAffiliate(affiliateId: string): Promise<number> {
    const [{ total }] = await this.cursor
      .select({ total: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.affiliateId, affiliateId)));

    return total;
  }

  /** Counts the referred users whose personal organization or a team they created settled a `payment_intent`, the payments their affiliate earns on, once each. */
  async countPayingByAffiliate(affiliateId: string): Promise<number> {
    const [{ total }] = await this.cursor
      .select({ total: countDistinct(this.table.referredUserId) })
      .from(this.table)
      .where(this.whereAccessibleBy(and(eq(this.table.affiliateId, affiliateId), exists(this.#settledPaymentsOfReferredUser()))));

    return total;
  }

  /** Newest first, with what each referred user paid by card and what their payments earned the affiliate, teams they created included. */
  async findSummariesByAffiliate(
    { affiliateId, affiliateUserId }: { affiliateId: string; affiliateUserId: string },
    { limit, offset }: { limit: number; offset: number }
  ): Promise<ReferralSummary[]> {
    const rows = await this.cursor
      .select({
        id: this.table.id,
        createdAt: this.table.createdAt,
        hasPaid: sql<boolean>`exists(${this.#settledPaymentsOfReferredUser()})`,
        paidCents: sql<string>`(${this.#paidCentsOfReferredUser()})`,
        earnedCents: sql<string>`(${this.#earnedCentsOnReferredUser(affiliateUserId)})`,
        wallet: { isTrialing: UserWallets.isTrialing, activatedAt: UserWallets.activatedAt, createdAt: UserWallets.createdAt }
      })
      .from(this.table)
      .leftJoin(UserWallets, eq(UserWallets.userId, this.table.referredUserId))
      .where(this.whereAccessibleBy(eq(this.table.affiliateId, affiliateId)))
      .orderBy(desc(this.table.createdAt), desc(this.table.id))
      .limit(limit)
      .offset(offset);

    return rows.map(row => ({
      id: row.id,
      createdAt: row.createdAt,
      hasPaid: row.hasPaid,
      paidCents: Number(row.paidCents),
      earnedCents: Number(row.earnedCents),
      wallet: row.wallet?.createdAt ? { isTrialing: !!row.wallet.isTrialing, activatedAt: row.wallet.activatedAt, createdAt: row.wallet.createdAt } : null
    }));
  }

  #paidCentsOfReferredUser() {
    return this.cursor
      .select({ total: sql`coalesce(sum(${ReferredPayments.amount} - ${ReferredPayments.amountRefunded}), 0)` })
      .from(ReferredPayments)
      .leftJoin(ReferredPaymentOrganizations, eq(ReferredPaymentOrganizations.id, ReferredPayments.organizationId))
      .where(this.#isSettledPaymentOfReferredUser());
  }

  #earnedCentsOnReferredUser(affiliateUserId: string) {
    return this.cursor
      .select({ total: sql`coalesce(sum(${ReferralCommissions.amount} - ${ReferralCommissions.amountRefunded}), 0)` })
      .from(ReferralCommissions)
      .innerJoin(ReferredPayments, eq(ReferredPayments.id, ReferralCommissions.sourceTransactionId))
      .leftJoin(ReferredPaymentOrganizations, eq(ReferredPaymentOrganizations.id, ReferredPayments.organizationId))
      .where(
        and(
          eq(ReferralCommissions.type, "affiliate_commission"),
          eq(ReferralCommissions.userId, affiliateUserId),
          inArray(ReferralCommissions.status, EARNED_COMMISSION_STATUSES),
          this.#isPaymentOfReferredUser()
        )
      );
  }

  #settledPaymentsOfReferredUser() {
    return this.cursor
      .select({ id: ReferredPayments.id })
      .from(ReferredPayments)
      .leftJoin(ReferredPaymentOrganizations, eq(ReferredPaymentOrganizations.id, ReferredPayments.organizationId))
      .where(this.#isSettledPaymentOfReferredUser());
  }

  #isSettledPaymentOfReferredUser() {
    return and(this.#isPaymentOfReferredUser(), eq(ReferredPayments.type, "payment_intent"), inArray(ReferredPayments.status, PAYING_PAYMENT_STATUSES));
  }

  #isPaymentOfReferredUser() {
    return or(
      eq(ReferredPaymentOrganizations.createdByUserId, this.table.referredUserId),
      and(isNull(ReferredPayments.organizationId), eq(ReferredPayments.userId, this.table.referredUserId))
    );
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
