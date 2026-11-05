import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { ClassifyConversation, ClassifyConversationHandler, classifyConversationOptionsFor } from "./classify-conversation.handler";

import { seedAssistantConversation, seedAssistantMessage } from "@test/seeders/db/feedback.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ClassifyConversationHandler)]);

describe(ClassifyConversationHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies an ended conversation from its messages and starts its theme, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user } = await seedUserWithWallet();
    const conversation = await seedAssistantConversation({ userId: user.id, status: "unresolved", endedAt: new Date() });
    await seedAssistantMessage({ conversationId: conversation.id, role: "user", content: "how do I open port 8080?" });
    await seedAssistantMessage({ conversationId: conversation.id, role: "assistant", content: "expose it in the SDL" });
    const akashMlClient = container.resolve(AkashMlClient);
    vi.spyOn(akashMlClient, "isAvailable").mockReturnValue(true);
    const createChatCompletion = vi.spyOn(akashMlClient, "createChatCompletion").mockResolvedValueOnce({
      content: JSON.stringify({ type: "support_question", summary: "How to expose a port", sentiment: -0.2, endedStuck: true }),
      toolCalls: [],
      finishReason: "stop",
      usage: null
    });
    const options = classifyConversationOptionsFor(conversation.id);

    await enqueue(new ClassifyConversation({ conversationId: conversation.id }), options);
    await startWorkers();
    await expectJobCompleted(ClassifyConversation[JOB_NAME], { singletonKey: options.singletonKey as string });

    const classified = await container.resolve(AssistantConversationRepository).findById(conversation.id);
    expect(classified).toMatchObject({ classificationType: "support_question", classificationSummary: "How to expose a port", endedStuck: true });
    expect(await container.resolve(FeedbackThemeRepository).findById(classified?.themeId as string)).toMatchObject({
      title: "How to expose a port",
      itemCount: 1
    });
    expect(JSON.stringify(createChatCompletion.mock.calls[0][0].messages)).toContain("how do I open port 8080?");
  });
});
