import { subDays, subMinutes } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { FeedbackInput } from "@src/feedback/http-schemas/feedback.schema";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { ClassifyFeedback } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserRepository } from "@src/user/repositories";
import { DAILY_SUBMISSION_LIMIT, FeedbackSubmissionService, OUTCOME_PROMPT_COOLDOWN_DAYS } from "./feedback-submission.service";

import { createFeedbackSubmission } from "@test/seeders/feedback-submission.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const FAKE_TOKEN = `hf_${"a1B2c3D4e5".repeat(3)}`;

const RATED_OUTCOME: FeedbackInput = { kind: "deployment_outcome", dseq: "21434557", outcome: "live", dismissed: false, rating: 4 };

describe(FeedbackSubmissionService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("stores a rated outcome with the user, the active organization and the trial status, and queues its classification", async () => {
      const { service, user, feedbackSubmissionRepository, jobQueueService, created } = setup({ organizationId: "org-1", isTrialing: true });

      const submission = await service.create({ ...RATED_OUTCOME, message: "went fine", page: "/deployments/21434557" });

      expect(submission).toBe(created);
      expect(feedbackSubmissionRepository.createUnlessAnswered).toHaveBeenCalledWith({
        kind: "deployment_outcome",
        dseq: "21434557",
        outcome: "live",
        dismissed: false,
        rating: 4,
        message: "went fine",
        userId: user.id,
        organizationId: "org-1",
        context: { isTrialing: true, page: "/deployments/21434557" }
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ClassifyFeedback({ feedbackSubmissionId: created.id }));
    });

    it("creates the submission as the signed-in user's ability allows", async () => {
      const { service, authService, feedbackSubmissionRepository } = setup();

      await service.create(RATED_OUTCOME);

      expect(feedbackSubmissionRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
    });

    it("redacts secrets in the message and the failure reason before storing them", async () => {
      const { service, feedbackSubmissionRepository } = setup();

      await service.create({
        kind: "deployment_outcome",
        dseq: "1",
        outcome: "failed",
        dismissed: false,
        rating: 1,
        message: `token ${FAKE_TOKEN} leaked`,
        failureReason: `pull failed for ${FAKE_TOKEN}`
      });

      expect(feedbackSubmissionRepository.createUnlessAnswered).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `token ${REDACTED} leaked`,
          context: { isTrialing: false, failureReason: `pull failed for ${REDACTED}` }
        })
      );
    });

    it("stores a dismissed prompt without rating or message and does not classify it", async () => {
      const { service, feedbackSubmissionRepository, jobQueueService } = setup({ created: { dismissed: true } });

      await service.create({ kind: "deployment_outcome", dseq: "7", outcome: "failed", dismissed: true });

      expect(feedbackSubmissionRepository.createUnlessAnswered).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "deployment_outcome", dseq: "7", dismissed: true, rating: null, message: null })
      );
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("stores general feedback with its category and redacted message and no deployment fields", async () => {
      const { service, feedbackSubmissionRepository, jobQueueService } = setup();

      await service.create({ kind: "general", category: "feature_request", message: `please add ${FAKE_TOKEN} support`, page: "/templates" });

      const [stored] = feedbackSubmissionRepository.createUnlessAnswered.mock.calls[0];
      expect(stored).toMatchObject({
        kind: "general",
        category: "feature_request",
        message: `please add ${REDACTED} support`,
        context: { page: "/templates" }
      });
      expect(stored).not.toHaveProperty("dseq");
      expect(stored).not.toHaveProperty("rating");
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    });

    it("records no organization and an unknown trial status for a user without organization context or wallet", async () => {
      const { service, feedbackSubmissionRepository } = setup({ hasWallet: false });

      await service.create(RATED_OUTCOME);

      expect(feedbackSubmissionRepository.createUnlessAnswered).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: null, context: { isTrialing: null } })
      );
    });

    it("reads the wallet the user uses, as their ability allows", async () => {
      const { service, user, authService, userWalletRepository } = setup();

      await service.create(RATED_OUTCOME);

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(userWalletRepository.findOneUsedBy).toHaveBeenCalledWith(user.id);
    });

    it("refuses with a conflict when the deployment's prompt was already answered", async () => {
      const { service, feedbackSubmissionRepository, jobQueueService } = setup();
      feedbackSubmissionRepository.createUnlessAnswered.mockResolvedValue(undefined);

      await expect(service.create(RATED_OUTCOME)).rejects.toMatchObject({
        status: 409,
        errorCode: "feedback_already_answered",
        message: "This deployment's outcome prompt was already answered"
      });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("refuses once the user reached the daily limit, counting the last day", async () => {
      const { service, user, feedbackSubmissionRepository } = setup({ sentToday: DAILY_SUBMISSION_LIMIT });

      await expect(service.create(RATED_OUTCOME)).rejects.toMatchObject({
        status: 429,
        errorCode: "feedback_limit",
        message: `You can send up to ${DAILY_SUBMISSION_LIMIT} feedback messages a day. Try again tomorrow.`
      });
      expect(feedbackSubmissionRepository.countSince).toHaveBeenCalledWith(user.id, subDays(NOW, 1));
      expect(feedbackSubmissionRepository.createUnlessAnswered).not.toHaveBeenCalled();
    });

    it("counts the day only after locking the user row inside the transaction, so concurrent submissions queue behind each other", async () => {
      const { service, user, txService, userRepository, feedbackSubmissionRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
        return await cb();
      });

      await service.create(RATED_OUTCOME);

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id }, { strength: "no key update" });
      expect(userRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(feedbackSubmissionRepository.countSince.mock.invocationCallOrder[0]);
    });

    it("accepts the last submission under the daily limit", async () => {
      const { service, feedbackSubmissionRepository } = setup({ sentToday: DAILY_SUBMISSION_LIMIT - 1 });

      await service.create(RATED_OUTCOME);

      expect(feedbackSubmissionRepository.createUnlessAnswered).toHaveBeenCalled();
    });

    it("stores and queues inside one transaction", async () => {
      const { service, txService, feedbackSubmissionRepository, jobQueueService } = setup();
      txService.transaction.mockImplementation(async cb => {
        expect(feedbackSubmissionRepository.createUnlessAnswered).not.toHaveBeenCalled();
        const result = await cb();
        expect(jobQueueService.enqueue).toHaveBeenCalled();
        return result;
      });

      await service.create(RATED_OUTCOME);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOutcomePrompt", () => {
    it("offers the prompt when the user never answered one", async () => {
      const { service, user, authService, feedbackSubmissionRepository } = setup();

      expect(await service.getOutcomePrompt("42")).toEqual({ dseq: "42", eligible: true, reason: null });
      expect(feedbackSubmissionRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(feedbackSubmissionRepository.findOneBy).toHaveBeenCalledWith({ userId: user.id, kind: "deployment_outcome", dseq: "42" });
      expect(feedbackSubmissionRepository.findLatestOutcomeAnswerAt).toHaveBeenCalledWith(user.id);
    });

    it("does not offer the prompt again for a deployment already answered", async () => {
      const { service, feedbackSubmissionRepository } = setup();
      feedbackSubmissionRepository.findOneBy.mockResolvedValue(createFeedbackSubmission({ dseq: "42" }));

      expect(await service.getOutcomePrompt("42")).toEqual({ dseq: "42", eligible: false, reason: "already_answered" });
    });

    it("holds the prompt back while another deployment was answered within the cooldown", async () => {
      const { service } = setup({ latestOutcomeAnswerAt: subMinutes(subDays(NOW, OUTCOME_PROMPT_COOLDOWN_DAYS), -1) });

      expect(await service.getOutcomePrompt("42")).toEqual({ dseq: "42", eligible: false, reason: "cooldown" });
    });

    it("offers the prompt again once the cooldown has passed", async () => {
      const { service } = setup({ latestOutcomeAnswerAt: subDays(NOW, OUTCOME_PROMPT_COOLDOWN_DAYS) });

      expect(await service.getOutcomePrompt("42")).toEqual({ dseq: "42", eligible: true, reason: null });
    });
  });

  function setup(
    input: {
      organizationId?: string;
      isTrialing?: boolean;
      hasWallet?: boolean;
      sentToday?: number;
      latestOutcomeAnswerAt?: Date;
      created?: Parameters<typeof createFeedbackSubmission>[0];
    } = {}
  ) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const created = createFeedbackSubmission({ userId: user.id, ...input.created });
    const feedbackSubmissionRepository = mock<FeedbackSubmissionRepository>();
    feedbackSubmissionRepository.accessibleBy.mockReturnValue(feedbackSubmissionRepository);
    feedbackSubmissionRepository.createUnlessAnswered.mockResolvedValue(created);
    feedbackSubmissionRepository.countSince.mockResolvedValue(input.sentToday ?? 0);
    feedbackSubmissionRepository.findOneBy.mockResolvedValue(undefined);
    feedbackSubmissionRepository.findLatestOutcomeAnswerAt.mockResolvedValue(input.latestOutcomeAnswerAt ?? null);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.accessibleBy.mockReturnValue(userWalletRepository);
    userWalletRepository.findOneUsedBy.mockResolvedValue(
      input.hasWallet === false ? undefined : createUserWallet({ userId: user.id, isTrialing: input.isTrialing ?? false })
    );
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(key =>
      key === "ORGANIZATION_CONTEXT" && input.organizationId ? mock<OrganizationContext>({ organizationId: input.organizationId }) : undefined
    );
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();

    const service = new FeedbackSubmissionService(
      feedbackSubmissionRepository,
      userWalletRepository,
      userRepository,
      authService,
      executionContextService,
      txService,
      jobQueueService
    );

    return { service, user, created, feedbackSubmissionRepository, userWalletRepository, userRepository, authService, txService, jobQueueService };
  }
});
