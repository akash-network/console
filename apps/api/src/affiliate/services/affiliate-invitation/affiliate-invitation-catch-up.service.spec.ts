import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService } from "@src/core";
import { AffiliateInvitationCatchUpService } from "./affiliate-invitation-catch-up.service";
import { InviteAffiliate } from "./invite-affiliate.job";

describe(AffiliateInvitationCatchUpService.name, () => {
  describe("run", () => {
    it("looks for the people whose net card spend reaches the self-join minimum", async () => {
      const { service, stripeTransactionRepository } = setup({ userIds: [], minSpendCents: 12_345 });

      await service.run({ dryRun: false });

      expect(stripeTransactionRepository.findUserIdsWithNetCardSpendAtLeast).toHaveBeenCalledWith(12_345);
    });

    it("enqueues one invitation per person, keyed by the person", async () => {
      const userIds = [faker.string.uuid(), faker.string.uuid()];
      const { service, jobQueueService } = setup({ userIds });

      await expect(service.run({ dryRun: false })).resolves.toEqual({ invited: 2 });

      expect(jobQueueService.enqueue.mock.calls).toEqual([
        [new InviteAffiliate({ userId: userIds[0] }), { singletonKey: `invite-affiliate:${userIds[0]}` }],
        [new InviteAffiliate({ userId: userIds[1] }), { singletonKey: `invite-affiliate:${userIds[1]}` }]
      ]);
    });

    it("counts only the invitations it enqueued, leaving a person whose invitation already waits to that one", async () => {
      const { service, jobQueueService } = setup({ userIds: [faker.string.uuid(), faker.string.uuid()] });
      jobQueueService.enqueue.mockResolvedValueOnce(null);

      await expect(service.run({ dryRun: false })).resolves.toEqual({ invited: 1 });
    });

    it("counts the people it would invite without enqueuing anything on a dry run", async () => {
      const { service, jobQueueService } = setup({ userIds: [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()] });

      await expect(service.run({ dryRun: true })).resolves.toEqual({ invited: 3 });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it.each([{ dryRun: true }, { dryRun: false }])("logs how many people it invited when dryRun is $dryRun", async ({ dryRun }) => {
      const { service, logger } = setup({ userIds: [faker.string.uuid()] });

      await service.run({ dryRun });

      expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_INVITATION_CATCH_UP", invited: 1, dryRun });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ userIds: [] });

    expect(createLogger).toHaveBeenCalledWith({ context: AffiliateInvitationCatchUpService.name });
  });

  function setup(input: { userIds: string[]; minSpendCents?: number }) {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findUserIdsWithNetCardSpendAtLeast.mockResolvedValue(input.userIds);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(async () => faker.string.uuid());
    const billingConfig = mock<BillingConfig>({ AFFILIATE_SELF_JOIN_MIN_SPEND_AMOUNT: input.minSpendCents ?? 10_000 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateInvitationCatchUpService(stripeTransactionRepository, jobQueueService, billingConfig, createLogger);

    return { service, stripeTransactionRepository, jobQueueService, logger, createLogger };
  }
});
