import { singleton } from "tsyringe";

import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { FeedbackClassificationService } from "@src/feedback/services/feedback-classification/feedback-classification.service";

export class ClassifyProblemReport implements Job {
  static readonly [JOB_NAME] = "ClassifyProblemReport";
  readonly name = ClassifyProblemReport[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { problemReportId: string }) {}
}

export function classifyProblemReportOptionsFor(problemReportId: string): EnqueueOptions {
  return { singletonKey: `classifyProblemReport.${problemReportId}` };
}

@singleton()
export class ClassifyProblemReportHandler implements JobHandler<ClassifyProblemReport> {
  public readonly accepts = ClassifyProblemReport;

  /** One job per report across queued, retrying and running, so the backfill never doubles a model call already under way. */
  public readonly policy = "exclusive";

  constructor(private readonly feedbackClassificationService: FeedbackClassificationService) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ problemReportId }: JobPayload<ClassifyProblemReport>): Promise<void> {
    await this.feedbackClassificationService.classifyProblemReport(problemReportId);
  }
}
