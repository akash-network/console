import { singleton } from "tsyringe";

import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { FeedbackClassificationService } from "@src/feedback/services/feedback-classification/feedback-classification.service";

/** Enqueued once a stored conversation ends or goes idle. */
export class ClassifyConversation implements Job {
  static readonly [JOB_NAME] = "ClassifyConversation";
  readonly name = ClassifyConversation[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { conversationId: string }) {}
}

export function classifyConversationOptionsFor(conversationId: string): EnqueueOptions {
  return { singletonKey: `classifyConversation.${conversationId}` };
}

@singleton()
export class ClassifyConversationHandler implements JobHandler<ClassifyConversation> {
  public readonly accepts = ClassifyConversation;

  /** One job per conversation across queued, retrying and running, so the backfill never doubles a model call already under way. */
  public readonly policy = "exclusive";

  constructor(private readonly feedbackClassificationService: FeedbackClassificationService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ conversationId }: JobPayload<ClassifyConversation>): Promise<void> {
    await this.feedbackClassificationService.classifyConversation(conversationId);
  }
}
