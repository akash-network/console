import { inject, singleton } from "tsyringe";

import { affiliateTermsOf } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { AffiliateInvitationRepository } from "@src/affiliate/repositories/affiliate-invitation/affiliate-invitation.repository";
import { AffiliateEnrollmentService } from "@src/affiliate/services/affiliate-enrollment/affiliate-enrollment.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { affiliateInvitationNotification } from "@src/notifications/services/notification-templates/affiliate-invitation-notification";
import {
  type PromotionalNotificationOutcome,
  PromotionalNotificationService
} from "@src/notifications/services/promotional-notification/promotional-notification.service";
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

    if (!(await this.affiliateInvitationRepository.claim(user.id, new Date()))) {
      this.#logger.info({ event: "AFFILIATE_INVITATION_SKIPPED", userId, reason: "already_invited" });
      return;
    }

    const outcome = await this.#sendOrReleaseClaim(user);
    this.#logger.info({ event: "AFFILIATE_INVITATION_HANDLED", userId, outcome });
  }

  /** Sends after the claim commits, so no database connection waits on the notification request, and gives the claim back for the retry when the email fails. */
  async #sendOrReleaseClaim(user: UserOutput): Promise<PromotionalNotificationOutcome> {
    try {
      const outcome = await this.promotionalNotificationService.send(
        user,
        affiliateInvitationNotification(user, {
          terms: affiliateTermsOf(this.billingConfig),
          referralsUrl: `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/referrals`
        })
      );
      if (outcome === "unsubscribe_unavailable") throw new Error("Affiliate invitation cannot be sent without an unsubscribe link");

      return outcome;
    } catch (error) {
      await this.affiliateInvitationRepository.release(user.id);
      throw error;
    }
  }
}
