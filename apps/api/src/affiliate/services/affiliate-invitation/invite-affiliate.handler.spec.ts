import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateInvitationRepository } from "@src/affiliate/repositories/affiliate-invitation/affiliate-invitation.repository";
import type { AffiliateEnrollmentEligibility, AffiliateEnrollmentService } from "@src/affiliate/services/affiliate-enrollment/affiliate-enrollment.service";
import type { BillingConfig } from "@src/billing/providers";
import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type {
  PromotionalNotificationOutcome,
  PromotionalNotificationService
} from "@src/notifications/services/promotional-notification/promotional-notification.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { InviteAffiliateHandler } from "./invite-affiliate.handler";
import { InviteAffiliate } from "./invite-affiliate.job";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

const DEPLOY_WEB_BASE_URL = "https://console.akash.network";

describe(InviteAffiliateHandler.name, () => {
  it("accepts the invitation job, one per person at a time, without permissions", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(InviteAffiliate);
    expect(handler.policy).toBe("exclusive");
    expect(handler.requiresPermission()).toEqual([]);
  });

  it("claims the invitation and sends the email with the configured terms and a link to the referrals page", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();

    await handler.handle({ userId: user.id, version: 1 });

    expect(affiliateInvitationRepository.claim).toHaveBeenCalledWith(user.id, expect.any(Date));
    expect(promotionalNotificationService.send).toHaveBeenCalledTimes(1);
    expect(promotionalNotificationService.send).toHaveBeenCalledWith(user, {
      notificationId: `affiliateInvitation.${user.id}`,
      payload: {
        summary: "Earn Console credit by referring friends",
        description: expect.stringContaining(
          "gets a $5 trial. You earn 5% of every card payment they make for 3 months, plus $5 if their first payment is $20 or more"
        ),
        actions: [{ label: "Join the referral program", url: `${DEPLOY_WEB_BASE_URL}/referrals` }]
      },
      user: { id: user.id, email: user.email }
    });
    expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_HANDLED", userId: user.id, outcome: "sent" });
  });

  it("claims the invitation before sending the email and keeps the claim once it is sent", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService } = setup();

    await handler.handle({ userId: user.id, version: 1 });

    expect(affiliateInvitationRepository.claim.mock.invocationCallOrder[0]).toBeLessThan(promotionalNotificationService.send.mock.invocationCallOrder[0]);
    expect(affiliateInvitationRepository.release).not.toHaveBeenCalled();
  });

  it("gives the claim back and fails so the job retries when the email cannot be sent", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();
    const failure = new Error("Failed to create notification");
    promotionalNotificationService.send.mockRejectedValue(failure);

    await expect(handler.handle({ userId: user.id, version: 1 })).rejects.toBe(failure);

    expect(affiliateInvitationRepository.release).toHaveBeenCalledWith(user.id);
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_INVITATION_HANDLED" }));
  });

  it("neither claims nor sends to a person who is not eligible", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup({
      eligibility: { eligible: false, reason: "below_min_spend" }
    });

    await handler.handle({ userId: user.id, version: 1 });

    expect(affiliateInvitationRepository.claim).not.toHaveBeenCalled();
    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_SKIPPED", userId: user.id, reason: "below_min_spend" });
  });

  it("neither claims nor sends when the person no longer exists", async () => {
    const { handler, user, userRepository, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();
    userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ userId: user.id, version: 1 });

    expect(affiliateInvitationRepository.claim).not.toHaveBeenCalled();
    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_SKIPPED", userId: user.id, reason: "user_not_found" });
  });

  it("sends nothing when the person was already invited", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();
    affiliateInvitationRepository.claim.mockResolvedValue(false);

    await handler.handle({ userId: user.id, version: 1 });

    expect(promotionalNotificationService.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_SKIPPED", userId: user.id, reason: "already_invited" });
  });

  it.each(["unsubscribed", "no_email"] as const)("keeps the claim when the email ends %s, so the person is never asked again", async outcome => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();
    promotionalNotificationService.send.mockResolvedValue(outcome);

    await expect(handler.handle({ userId: user.id, version: 1 })).resolves.toBeUndefined();

    expect(affiliateInvitationRepository.release).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_HANDLED", userId: user.id, outcome });
  });

  it("gives the claim back and fails so the job retries when no unsubscribe link can be made", async () => {
    const { handler, user, affiliateInvitationRepository, promotionalNotificationService, logger } = setup();
    promotionalNotificationService.send.mockResolvedValue("unsubscribe_unavailable" satisfies PromotionalNotificationOutcome);

    await expect(handler.handle({ userId: user.id, version: 1 })).rejects.toThrow("Affiliate invitation cannot be sent without an unsubscribe link");

    expect(affiliateInvitationRepository.release).toHaveBeenCalledWith(user.id);
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_INVITATION_HANDLED" }));
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: InviteAffiliateHandler.name });
  });

  function setup(input: { eligibility?: AffiliateEnrollmentEligibility } = {}) {
    const user: UserOutput = createUser({ email: "referrer@example.com" });
    const affiliateEnrollmentService = mock<AffiliateEnrollmentService>();
    affiliateEnrollmentService.checkEligibility.mockResolvedValue(input.eligibility ?? { eligible: true });
    const affiliateInvitationRepository = mock<AffiliateInvitationRepository>();
    affiliateInvitationRepository.claim.mockResolvedValue(true);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(user);
    const promotionalNotificationService = mock<PromotionalNotificationService>();
    promotionalNotificationService.send.mockResolvedValue("sent");
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL });
    const billingConfig = mock<BillingConfig>({
      REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 5_000_000,
      AFFILIATE_COMMISSION_HOLD_SECONDS: 2_592_000,
      AFFILIATE_FIRST_PURCHASE_BONUS_AMOUNT: 500,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_PAYMENT_AMOUNT: 2000,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_USAGE_AMOUNT: 2000
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new InviteAffiliateHandler(
      affiliateEnrollmentService,
      affiliateInvitationRepository,
      userRepository,
      promotionalNotificationService,
      deploymentConfigService,
      billingConfig,
      createLogger
    );

    return {
      handler,
      user,
      affiliateEnrollmentService,
      affiliateInvitationRepository,
      userRepository,
      promotionalNotificationService,
      logger,
      createLogger
    };
  }
});
