import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeedbackClassificationService } from "@src/feedback/services/feedback-classification/feedback-classification.service";
import { ClassifyFeedback, ClassifyFeedbackHandler, classifyFeedbackOptionsFor } from "./classify-feedback.handler";

describe(ClassifyFeedbackHandler.name, () => {
  it("accepts the classify feedback job, one per submission, and needs no permission", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(ClassifyFeedback);
    expect(handler.policy).toBe("exclusive");
    expect(handler.requiresPermission()).toEqual([]);
  });

  it("classifies the submission", async () => {
    const { handler, feedbackClassificationService } = setup();

    await handler.handle({ feedbackSubmissionId: "submission-1", version: 1 });

    expect(feedbackClassificationService.classifySubmission).toHaveBeenCalledWith("submission-1");
  });

  it("keys each job by its submission", () => {
    expect(classifyFeedbackOptionsFor("submission-1")).toEqual({ singletonKey: "classifyFeedback.submission-1" });
    expect(new ClassifyFeedback({ feedbackSubmissionId: "submission-1" })).toMatchObject({ name: "ClassifyFeedback", version: 1 });
  });

  function setup() {
    const feedbackClassificationService = mock<FeedbackClassificationService>();
    const handler = new ClassifyFeedbackHandler(feedbackClassificationService);

    return { handler, feedbackClassificationService };
  }
});
