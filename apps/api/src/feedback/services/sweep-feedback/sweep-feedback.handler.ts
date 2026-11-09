import { addHours, subDays, subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { ClassifyConversation, classifyConversationOptionsFor } from "@src/feedback/services/classify-conversation/classify-conversation.handler";
import { ClassifyFeedback, classifyFeedbackOptionsFor } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import { FeedbackThemeScoreService } from "@src/feedback/services/feedback-theme-score/feedback-theme-score.service";

export const SWEEP_FEEDBACK_INTERVAL_IN_HOURS = 1;
export const SWEEP_FEEDBACK_KEY = "sweepFeedback";
export const BACKFILL_BATCH_SIZE = 100;
export const CONVERSATION_IDLE_MINUTES = 30;
export const ASSISTANT_TURN_TRACE_RETENTION_DAYS = 90;
/** Must stay well past the longest a turn can run, so only a trace whose pod died mid-turn is still running after it. */
export const ABANDONED_TURN_TRACE_MINUTES = 10;

/** Classifies what was stored while the model was unavailable or whose job gave up, lets theme scores decay, and drops assistant turns the browser never resumed and turn traces past retention, and fails turn traces a crashed pod left running. */
export class SweepFeedback implements Job {
  static readonly [JOB_NAME] = "SweepFeedback";
  readonly name = SweepFeedback[JOB_NAME];
  readonly version = 1;
  readonly data: Record<string, never> = {};
}

export function sweepFeedbackOptionsFor(now: Date): EnqueueOptions {
  return { singletonKey: SWEEP_FEEDBACK_KEY, startAfter: addHours(now, SWEEP_FEEDBACK_INTERVAL_IN_HOURS).toISOString() };
}

@singleton()
export class SweepFeedbackHandler implements JobHandler<SweepFeedback> {
  public readonly accepts = SweepFeedback;

  /** One waiting sweep, so each run and every new submission keep the next one queued without piling them up. */
  public readonly policy = "short";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly feedbackSubmissionRepository: FeedbackSubmissionRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly akashMlClient: AkashMlClient,
    private readonly feedbackThemeScoreService: FeedbackThemeScoreService,
    private readonly assistantPendingTurnRepository: AssistantPendingTurnRepository,
    private readonly assistantTurnTraceRepository: AssistantTurnTraceRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: SweepFeedbackHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(): Promise<void> {
    const now = new Date();
    await this.jobQueueService.enqueue(new SweepFeedback(), sweepFeedbackOptionsFor(now));

    const backfilled = this.akashMlClient.isAvailable() ? await this.#enqueueUnclassified(now) : null;
    const rescored = await this.feedbackThemeScoreService.rescoreAll(now);
    const expiredPendingTurns = await this.assistantPendingTurnRepository.deleteExpired(now);
    const deletedTurnTraces = await this.assistantTurnTraceRepository.deleteStartedBefore(subDays(now, ASSISTANT_TURN_TRACE_RETENTION_DAYS));
    const abandonedTurnTraces = await this.assistantTurnTraceRepository.markAbandoned(subMinutes(now, ABANDONED_TURN_TRACE_MINUTES));

    this.#logger.info({ event: "FEEDBACK_SWEPT", backfilled, rescored, expiredPendingTurns, deletedTurnTraces, abandonedTurnTraces });
  }

  async #enqueueUnclassified(now: Date): Promise<{ submissions: number; conversations: number }> {
    const submissionIds = await this.feedbackSubmissionRepository.findUnclassifiedIds(BACKFILL_BATCH_SIZE);
    for (const feedbackSubmissionId of submissionIds) {
      await this.jobQueueService.enqueue(new ClassifyFeedback({ feedbackSubmissionId }), classifyFeedbackOptionsFor(feedbackSubmissionId));
    }

    const conversationIds = await this.assistantConversationRepository.findUnclassifiedIds(subMinutes(now, CONVERSATION_IDLE_MINUTES), BACKFILL_BATCH_SIZE);
    for (const conversationId of conversationIds) {
      await this.jobQueueService.enqueue(new ClassifyConversation({ conversationId }), classifyConversationOptionsFor(conversationId));
    }

    return { submissions: submissionIds.length, conversations: conversationIds.length };
  }
}
