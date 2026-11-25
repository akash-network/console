import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { type AffiliateTerms, affiliateTermsOf } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { type AffiliateProfile, AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

export type IneligibleReason = "program_disabled" | "enrollment_disabled" | "already_affiliate" | "revoked" | "abuse_locked" | "below_min_spend";

export type AffiliateEnrollmentEligibility = { eligible: boolean; reason?: IneligibleReason };

export const SELF_SERVICE_ACTOR = "self-service";

@singleton()
export class AffiliateEnrollmentService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly affiliateRepository: AffiliateRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly featureFlagsService: FeatureFlagsService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateEnrollmentService.name });
  }

  async checkEligibility(userId: string): Promise<AffiliateEnrollmentEligibility> {
    const reason = await this.#findIneligibleReason(userId);
    return reason ? { eligible: false, reason } : { eligible: true };
  }

  async getEligibility(userId: string): Promise<{ eligible: boolean; terms: AffiliateTerms }> {
    const { eligible, reason } = await this.checkEligibility(userId);
    if (reason) this.#logger.debug({ event: "AFFILIATE_ENROLLMENT_INELIGIBLE", userId, reason });

    return { eligible, terms: affiliateTermsOf(this.billingConfig) };
  }

  async join(userId: string): Promise<AffiliateProfile> {
    const existingProfile = await this.affiliateService.getProfile(userId);
    if (existingProfile) return existingProfile;

    const { reason } = await this.checkEligibility(userId);
    if (reason === "already_affiliate") return this.#requireProfile(userId);
    if (reason) {
      this.#logger.info({ event: "AFFILIATE_ENROLLMENT_INELIGIBLE", userId, reason });
      throw this.#ineligibleError();
    }

    await this.#approveUnlessJoinedConcurrently(userId);

    return this.#requireProfile(userId);
  }

  async #findIneligibleReason(userId: string): Promise<IneligibleReason | undefined> {
    if (!this.featureFlagsService.isEnabledForSubject(FeatureFlags.AFFILIATE_PROGRAM, userId)) return "program_disabled";
    if (!this.featureFlagsService.isEnabledForSubject(FeatureFlags.AFFILIATE_OPEN_ENROLLMENT, userId)) return "enrollment_disabled";

    const affiliate = await this.affiliateRepository.findByUserId(userId);
    if (affiliate) return affiliate.revokedAt ? "revoked" : "already_affiliate";

    if (await this.#isAbuseLocked(userId)) return "abuse_locked";
    if ((await this.#netCardSpendCents(userId)) < this.billingConfig.AFFILIATE_SELF_JOIN_MIN_SPEND_AMOUNT) return "below_min_spend";

    return undefined;
  }

  /** The wallet is filed under the personal organization, which the caller's active team would otherwise scope out. */
  async #isAbuseLocked(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepository.unscoped("affiliate-enrollment").findOneByUserId(userId);
    return !!wallet?.abuseLockedAt;
  }

  async #netCardSpendCents(userId: string): Promise<number> {
    const organizations = await this.organizationRepository.find({ createdByUserId: userId });
    return this.stripeTransactionRepository.sumNetCardPaymentsByOrganizations(organizations.map(organization => organization.id));
  }

  async #approveUnlessJoinedConcurrently(userId: string): Promise<void> {
    try {
      const affiliate = await this.affiliateService.enroll({ userId, actor: SELF_SERVICE_ACTOR });
      this.#logger.info({ event: "AFFILIATE_SELF_JOINED", userId, code: affiliate.code });
    } catch (error) {
      if (!isHttpError(error) || error.errorCode !== "affiliate_already_approved") throw error;
    }
  }

  async #requireProfile(userId: string): Promise<AffiliateProfile> {
    const profile = await this.affiliateService.getProfile(userId);
    if (!profile) throw this.#ineligibleError();

    return profile;
  }

  #ineligibleError() {
    return createError(403, "You are not eligible to join the referral program", { errorCode: "affiliate_enrollment_ineligible" });
  }
}
