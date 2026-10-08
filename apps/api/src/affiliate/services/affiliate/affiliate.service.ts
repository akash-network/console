import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { generateAffiliateCode, normalizeAffiliateCode } from "@src/affiliate/lib/affiliate-code/affiliate-code";
import { AFFILIATE_COMMISSION_MONTHS, AFFILIATE_COMMISSION_PERCENT } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { type AffiliateOutput, AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { getPostgresError, isUniqueViolation } from "@src/core/repositories/base.repository";
import { UserRepository } from "@src/user/repositories";

const MAX_GENERATED_CODE_ATTEMPTS = 5;
const MICRO_DENOM_PER_UNIT = 1_000_000;
const CENTS_PER_USD = 100;

export type ApproveAffiliateInput = { userId?: string; email?: string; code?: string; actor: string };
export type RevokeAffiliateInput = { code: string; actor: string };
export type AffiliateProfile = {
  code: string;
  terms: {
    commissionPercent: number;
    commissionMonths: number;
    referralTrialCreditsUsd: number;
  };
  stats: {
    signups: number;
    payingUsers: number;
    totalCommissionUsd: number;
    monthCommissionUsd: number;
  };
  commissions: {
    id: string;
    createdAt: string;
    amountUsd: number;
    reversedUsd: number;
  }[];
};

@singleton()
export class AffiliateService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly affiliateRepository: AffiliateRepository,
    private readonly referralRepository: ReferralRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly userRepository: UserRepository,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AffiliateService.name });
  }

  async approve({ userId, email, code, actor }: ApproveAffiliateInput): Promise<AffiliateOutput> {
    const resolvedUserId = await this.#resolveUserId({ userId, email });
    const normalizedCode = code !== undefined ? this.#requireValidCode(code) : undefined;
    const existing = await this.affiliateRepository.findByUserId(resolvedUserId);

    if (existing && !existing.revokedAt) {
      throw this.#alreadyApprovedError();
    }

    if (normalizedCode) await this.#assertCodeAvailable(normalizedCode, existing?.id);

    const approvedAt = new Date();
    const affiliate = existing
      ? await this.#writeApproval(existing, { code: normalizedCode, approvedAt, actor })
      : await this.#createWithCode({ userId: resolvedUserId, code: normalizedCode, approvedAt, actor });

    this.logger.info({ event: "AFFILIATE_APPROVED", actor, userId: resolvedUserId, code: affiliate.code });

    return affiliate;
  }

  async revoke({ code, actor }: RevokeAffiliateInput): Promise<AffiliateOutput> {
    const normalizedCode = normalizeAffiliateCode(code);
    const affiliate = normalizedCode ? await this.affiliateRepository.findByCode(normalizedCode) : undefined;

    if (!affiliate) throw createError(404, "No affiliate with this code was found", { errorCode: "affiliate_not_found" });
    if (affiliate.revokedAt) return affiliate;

    const revoked = await this.affiliateRepository.updateById(affiliate.id, { revokedAt: new Date(), revokedBy: actor }, { returning: true });

    this.logger.info({ event: "AFFILIATE_REVOKED", actor, userId: affiliate.userId, code: affiliate.code });

    return revoked;
  }

  async findActiveByCode(rawCode: string): Promise<AffiliateOutput | undefined> {
    const normalizedCode = normalizeAffiliateCode(rawCode);
    if (!normalizedCode) return undefined;

    const affiliate = await this.affiliateRepository.findByCode(normalizedCode);
    return affiliate && !affiliate.revokedAt ? affiliate : undefined;
  }

  async findActiveByUserId(userId: string): Promise<AffiliateOutput | undefined> {
    const affiliate = await this.affiliateRepository.findByUserId(userId);
    return affiliate && !affiliate.revokedAt ? affiliate : undefined;
  }

  async getProfile(userId: string): Promise<AffiliateProfile | null> {
    const affiliate = await this.findActiveByUserId(userId);
    if (!affiliate) return null;

    const currentMonthStart = this.#currentUtcMonthStart();
    const [signups, payingUsers, totalCommissionCents, monthCommissionCents, commissions] = await Promise.all([
      this.referralRepository.countByAffiliate(affiliate.id),
      this.referralRepository.countPayingByAffiliate(affiliate.id),
      this.stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.userId),
      this.stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.userId, currentMonthStart),
      this.stripeTransactionRepository.findAffiliateCommissions(affiliate.userId)
    ]);

    return {
      code: affiliate.code,
      terms: {
        commissionPercent: AFFILIATE_COMMISSION_PERCENT,
        commissionMonths: AFFILIATE_COMMISSION_MONTHS,
        referralTrialCreditsUsd: this.billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / MICRO_DENOM_PER_UNIT
      },
      stats: {
        signups,
        payingUsers,
        totalCommissionUsd: totalCommissionCents / CENTS_PER_USD,
        monthCommissionUsd: monthCommissionCents / CENTS_PER_USD
      },
      commissions: commissions.map(commission => ({
        id: commission.id,
        createdAt: commission.createdAt.toISOString(),
        amountUsd: commission.amount / CENTS_PER_USD,
        reversedUsd: commission.amountRefunded / CENTS_PER_USD
      }))
    };
  }

  #currentUtcMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  async #resolveUserId({ userId, email }: { userId?: string; email?: string }): Promise<string> {
    if (userId) {
      const user = await this.userRepository.findById(userId);
      if (!user) throw createError(404, "No user with this id was found", { errorCode: "affiliate_user_not_found" });
      return user.id;
    }

    if (!email) throw createError(400, "Provide a userId or an email", { errorCode: "affiliate_user_required" });

    const users = await this.userRepository.find({ email });
    if (users.length === 0) throw createError(404, "No user with this email was found", { errorCode: "affiliate_user_not_found" });
    if (users.length > 1) throw createError(409, "Several users share this email; approve by userId instead", { errorCode: "affiliate_email_ambiguous" });

    return users[0].id;
  }

  #requireValidCode(code: string): string {
    const normalized = normalizeAffiliateCode(code);
    if (!normalized) throw createError(400, "Invalid affiliate code", { errorCode: "affiliate_code_invalid" });
    return normalized;
  }

  async #assertCodeAvailable(code: string, excludingAffiliateId?: string): Promise<void> {
    const match = await this.affiliateRepository.findByCode(code);
    if (match && match.id !== excludingAffiliateId) {
      throw this.#codeTakenError();
    }
  }

  async #writeApproval(existing: AffiliateOutput, { code, approvedAt, actor }: { code?: string; approvedAt: Date; actor: string }): Promise<AffiliateOutput> {
    try {
      return await this.affiliateRepository.updateById(
        existing.id,
        { code: code ?? existing.code, approvedAt, approvedBy: actor, revokedAt: null, revokedBy: null },
        { returning: true }
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw this.#codeTakenError();
    }
  }

  async #createWithCode({ userId, code, approvedAt, actor }: { userId: string; code?: string; approvedAt: Date; actor: string }): Promise<AffiliateOutput> {
    if (code) {
      return this.#createOrConflict({ userId, code, approvedAt, actor });
    }

    for (let attempt = 0; attempt < MAX_GENERATED_CODE_ATTEMPTS; attempt++) {
      const candidate = generateAffiliateCode();
      if (await this.affiliateRepository.findByCode(candidate)) continue;

      try {
        return await this.affiliateRepository.create({ userId, code: candidate, approvedAt, approvedBy: actor });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (this.#isUserIdConflict(error)) throw this.#alreadyApprovedError();
      }
    }

    throw createError(500, "Could not generate a unique affiliate code", { errorCode: "affiliate_code_generation_failed" });
  }

  async #createOrConflict({ userId, code, approvedAt, actor }: { userId: string; code: string; approvedAt: Date; actor: string }): Promise<AffiliateOutput> {
    try {
      return await this.affiliateRepository.create({ userId, code, approvedAt, approvedBy: actor });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw this.#isUserIdConflict(error) ? this.#alreadyApprovedError() : this.#codeTakenError();
    }
  }

  #isUserIdConflict(error: unknown): boolean {
    return getPostgresError(error)?.constraint_name?.includes("user_id") ?? false;
  }

  #alreadyApprovedError() {
    return createError(409, "This user is already an approved affiliate", { errorCode: "affiliate_already_approved" });
  }

  #codeTakenError() {
    return createError(409, "This code is already used by another affiliate", { errorCode: "affiliate_code_taken" });
  }
}
