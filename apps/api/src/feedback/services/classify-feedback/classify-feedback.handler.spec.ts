import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { ClassifyFeedback, ClassifyFeedbackHandler } from "./classify-feedback.handler";

describe(ClassifyFeedbackHandler.name, () => {
  it("accepts the classify feedback job and needs no permission", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(ClassifyFeedback);
    expect(handler.requiresPermission()).toEqual([]);
  });

  it("records that the submission waits for classification", async () => {
    const { handler, logger } = setup();

    await handler.handle({ feedbackSubmissionId: "submission-1", version: 1 });

    expect(logger.info).toHaveBeenCalledWith({ event: "FEEDBACK_CLASSIFICATION_PENDING", feedbackSubmissionId: "submission-1" });
  });

  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ClassifyFeedbackHandler.name });
  });

  function setup() {
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new ClassifyFeedbackHandler(createLogger);

    return { handler, logger, createLogger };
  }
});
