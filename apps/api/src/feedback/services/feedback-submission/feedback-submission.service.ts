import { subDays } from "date-fns";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { FeedbackInput, FeedbackOutcomePrompt } from "@src/feedback/http-schemas/feedback.schema";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { FeedbackContext } from "@src/feedback/model-schemas";
import {
  type FeedbackSubmissionInsert,
  type FeedbackSubmissionOutput,
  FeedbackSubmissionRepository
} from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { ClassifyFeedback, classifyFeedbackOptionsFor } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import { SweepFeedback, sweepFeedbackOptionsFor } from "@src/feedback/services/sweep-feedback/sweep-feedback.handler";
import { UserRepository } from "@src/user/repositories";

export const OUTCOME_PROMPT_COOLDOWN_DAYS = 7;
export const DAILY_SUBMISSION_LIMIT = 20;

function redactedOrNull(text: string | undefined): string | null {
  return text ? redactSecrets(text) : null;
}

function submissionFieldsOf(input: FeedbackInput): Omit<FeedbackSubmissionInsert, "userId" | "context"> {
  if (input.kind === "general") {
    return { kind: input.kind, category: input.category, message: redactSecrets(input.message) };
  }

  return {
    kind: input.kind,
    dseq: input.dseq,
    outcome: input.outcome,
    dismissed: input.dismissed,
    rating: input.rating ?? null,
    message: redactedOrNull(input.message)
  };
}

@singleton()
export class FeedbackSubmissionService {
  constructor(
    private readonly feedbackSubmissionRepository: FeedbackSubmissionRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService
  ) {}

  async create(input: FeedbackInput): Promise<FeedbackSubmissionOutput> {
    const userId = this.authService.currentUser.id;
    const context = await this.#contextOf(userId, input);

    return await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId }, { strength: "no key update" });
      await this.#assertWithinDailyLimit(userId);

      const submission = await this.feedbackSubmissionRepository.accessibleBy(this.authService.ability, "create").createUnlessAnswered({
        ...submissionFieldsOf(input),
        userId,
        organizationId: this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId ?? null,
        context
      });

      if (!submission) {
        throw createError(409, "This deployment's outcome prompt was already answered", { errorCode: "feedback_already_answered" });
      }

      if (!submission.dismissed) {
        await this.jobQueueService.enqueue(new ClassifyFeedback({ feedbackSubmissionId: submission.id }), classifyFeedbackOptionsFor(submission.id));
      }

      await this.jobQueueService.enqueue(new SweepFeedback(), sweepFeedbackOptionsFor(new Date()));

      return submission;
    });
  }

  /** "Not now" counts as an answer, both for the deployment and for the cooldown. */
  async getOutcomePrompt(dseq: string): Promise<FeedbackOutcomePrompt> {
    const userId = this.authService.currentUser.id;
    const submissions = this.feedbackSubmissionRepository.accessibleBy(this.authService.ability, "read");

    if (await submissions.findOneBy({ userId, kind: "deployment_outcome", dseq })) {
      return { dseq, eligible: false, reason: "already_answered" };
    }

    const latestAnswerAt = await submissions.findLatestOutcomeAnswerAt(userId);

    if (latestAnswerAt && latestAnswerAt > subDays(new Date(), OUTCOME_PROMPT_COOLDOWN_DAYS)) {
      return { dseq, eligible: false, reason: "cooldown" };
    }

    return { dseq, eligible: true, reason: null };
  }

  async #contextOf(userId: string, input: FeedbackInput): Promise<FeedbackContext> {
    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").findOneUsedBy(userId);
    const failureReason = input.kind === "deployment_outcome" ? redactedOrNull(input.failureReason) : null;

    return {
      isTrialing: wallet?.isTrialing ?? null,
      ...(input.page && { page: input.page }),
      ...(failureReason && { failureReason })
    };
  }

  async #assertWithinDailyLimit(userId: string): Promise<void> {
    const sentToday = await this.feedbackSubmissionRepository.countSince(userId, subDays(new Date(), 1));

    if (sentToday >= DAILY_SUBMISSION_LIMIT) {
      throw createError(429, `You can send up to ${DAILY_SUBMISSION_LIMIT} feedback messages a day. Try again tomorrow.`, {
        errorCode: "feedback_limit"
      });
    }
  }
}
