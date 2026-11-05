import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";

export class ClassifyFeedback implements Job {
  static readonly [JOB_NAME] = "ClassifyFeedback";
  readonly name = ClassifyFeedback[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { feedbackSubmissionId: string }) {}
}

/** Completes without classifying until a model is wired in; submissions keep a null classified_at, which is what the classifier backfills from. */
@singleton()
export class ClassifyFeedbackHandler implements JobHandler<ClassifyFeedback> {
  public readonly accepts = ClassifyFeedback;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(@inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#logger = createLogger({ context: ClassifyFeedbackHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ feedbackSubmissionId }: JobPayload<ClassifyFeedback>): Promise<void> {
    this.#logger.info({ event: "FEEDBACK_CLASSIFICATION_PENDING", feedbackSubmissionId });
  }
}
