import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { CreateFeedbackRequest, CreateFeedbackResponse, FeedbackOutcomePromptResponse } from "@src/feedback/http-schemas/feedback.schema";
import { FeedbackSubmissionService } from "@src/feedback/services/feedback-submission/feedback-submission.service";

@singleton()
export class FeedbackController {
  constructor(private readonly feedbackSubmissionService: FeedbackSubmissionService) {}

  @Protected([{ action: "create", subject: "FeedbackSubmission" }])
  async create(input: CreateFeedbackRequest["data"]): Promise<CreateFeedbackResponse> {
    const { id, createdAt } = await this.feedbackSubmissionService.create(input);
    return { data: { id, createdAt: createdAt.toISOString() } };
  }

  @Protected([{ action: "read", subject: "FeedbackSubmission" }])
  async getOutcomePrompt(dseq: string): Promise<FeedbackOutcomePromptResponse> {
    return { data: await this.feedbackSubmissionService.getOutcomePrompt(dseq) };
  }
}
