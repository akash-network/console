import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeedbackClassificationService } from "@src/feedback/services/feedback-classification/feedback-classification.service";
import { ClassifyConversation, ClassifyConversationHandler, classifyConversationOptionsFor } from "./classify-conversation.handler";

describe(ClassifyConversationHandler.name, () => {
  it("accepts the classify conversation job, one per conversation, and needs no permission", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(ClassifyConversation);
    expect(handler.policy).toBe("exclusive");
    expect(handler.requiresPermission()).toEqual([]);
  });

  it("classifies the conversation", async () => {
    const { handler, feedbackClassificationService } = setup();

    await handler.handle({ conversationId: "conversation-1", version: 1 });

    expect(feedbackClassificationService.classifyConversation).toHaveBeenCalledWith("conversation-1");
  });

  it("keys each job by its conversation", () => {
    expect(classifyConversationOptionsFor("conversation-1")).toEqual({ singletonKey: "classifyConversation.conversation-1" });
    expect(new ClassifyConversation({ conversationId: "conversation-1" })).toMatchObject({ name: "ClassifyConversation", version: 1 });
  });

  function setup() {
    const feedbackClassificationService = mock<FeedbackClassificationService>();
    const handler = new ClassifyConversationHandler(feedbackClassificationService);

    return { handler, feedbackClassificationService };
  }
});
