import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TxService } from "@src/core/services/tx/tx.service";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import { AssistantTranscriptService } from "./assistant-transcript.service";

describe(AssistantTranscriptService.name, () => {
  it("stores the message and moves the conversation's last message time, in one transaction", async () => {
    const { service, messageRepository, conversationRepository, txService } = setup();

    await service.record("conversation-1", { role: "tool", content: "Read deployment 42", toolName: "get_deployment", toolPayload: { ok: true } });

    expect(txService.transaction).toHaveBeenCalledTimes(1);
    expect(messageRepository.create).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      role: "tool",
      content: "Read deployment 42",
      toolName: "get_deployment",
      toolPayload: { ok: true }
    });
    expect(conversationRepository.updateById).toHaveBeenCalledWith("conversation-1", { lastMessageAt: expect.any(Date) });
  });

  function setup() {
    const messageRepository = mock<AssistantMessageRepository>();
    const conversationRepository = mock<AssistantConversationRepository>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());
    const service = new AssistantTranscriptService(messageRepository, conversationRepository, txService);

    return { service, messageRepository, conversationRepository, txService };
  }
});
