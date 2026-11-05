import { singleton } from "tsyringe";

import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { FeedbackClassificationService } from "@src/feedback/services/feedback-classification/feedback-classification.service";

export class ClassifyFeedback implements Job {
  static readonly [JOB_NAME] = "ClassifyFeedback";
  readonly name = ClassifyFeedback[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { feedbackSubmissionId: string }) {}
}

export function classifyFeedbackOptionsFor(feedbackSubmissionId: string): EnqueueOptions {
  return { singletonKey: `classifyFeedback.${feedbackSubmissionId}` };
}

@singleton()
export class ClassifyFeedbackHandler implements JobHandler<ClassifyFeedback> {
  public readonly accepts = ClassifyFeedback;

  /** One job per submission across queued, retrying and running, so the backfill never doubles a model call already under way. */
  public readonly policy = "exclusive";

  constructor(private readonly feedbackClassificationService: FeedbackClassificationService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ feedbackSubmissionId }: JobPayload<ClassifyFeedback>): Promise<void> {
    await this.feedbackClassificationService.classifySubmission(feedbackSubmissionId);
  }
}
