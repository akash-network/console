import { inject, singleton } from "tsyringe";

import { affiliateTermsOf } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { AffiliateInvitationRepository } from "@src/affiliate/repositories/affiliate-invitation/affiliate-invitation.repository";
import { AffiliateEnrollmentService } from "@src/affiliate/services/affiliate-enrollment/affiliate-enrollment.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { affiliateInvitationNotification } from "@src/notifications/services/notification-templates/affiliate-invitation-notification";
import { PromotionalNotificationService } from "@src/notifications/services/promotional-notification/promotional-notification.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { InviteAffiliate } from "./invite-affiliate.job";

@singleton()
export class InviteAffiliateHandler implements JobHandler<InviteAffiliate> {
  public readonly accepts = InviteAffiliate;

  /** With the per-person singletonKey, keeps an invitation queued twice from running twice at once. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly affiliateEnrollmentService: AffiliateEnrollmentService,
    private readonly affiliateInvitationRepository: AffiliateInvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly promotionalNotificationService: PromotionalNotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    private readonly txService: TxService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: InviteAffiliateHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId }: JobPayload<InviteAffiliate>): Promise<void> {
    const { eligible, reason } = await this.affiliateEnrollmentService.checkEligibility(userId);
    if (!eligible) {
      this.#logger.info({ event: "AFFILIATE_INVITATION_SKIPPED", userId, reason });
      return;
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      this.#logger.info({ event: "AFFILIATE_INVITATION_SKIPPED", userId, reason: "user_not_found" });
      return;
    }

    await this.txService.transaction(async () => await this.#claimAndSend(user));
  }

  /** Claims and sends in one transaction, so an email that fails to go out releases the claim for the retry. */
  async #claimAndSend(user: UserOutput): Promise<void> {
    if (!(await this.affiliateInvitationRepository.claim(user.id, new Date()))) {
      this.#logger.info({ event: "AFFILIATE_INVITATION_SKIPPED", userId: user.id, reason: "already_invited" });
      return;
    }

    const outcome = await this.promotionalNotificationService.send(
      user,
      affiliateInvitationNotification(user, {
        terms: affiliateTermsOf(this.billingConfig),
        referralsUrl: `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/referrals`
      })
    );

    if (outcome === "unsubscribe_unavailable") {
      throw new Error("Affiliate invitation cannot be sent without an unsubscribe link");
    }

    this.#logger.info({ event: "AFFILIATE_INVITATION_HANDLED", userId: user.id, outcome });
  }
}
