import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TxService } from "@src/core/services/tx/tx.service";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
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

  it("stores the content and tool payload with secrets redacted and other values unchanged", async () => {
    const { service, messageRepository } = setup();
    const proposalId = faker.string.uuid();

    await service.record("conversation-1", {
      role: "tool",
      content: `Proposed an update with HF_TOKEN=${faker.string.alphanumeric(16)}`,
      toolName: "propose_update_deployment",
      toolPayload: {
        proposalId,
        action: {
          dseq: "42",
          after: { command: ["sh", "-c"], args: [`--api-key=sk-${faker.string.alphanumeric(24)}`], env: [{ api_key: `api_key: ${faker.string.alphanumeric(12)}` }] },
          replicas: 3,
          persistent: true
        },
        diagnosis: null
      }
    });

    expect(messageRepository.create).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      role: "tool",
      content: `Proposed an update with HF_TOKEN=${REDACTED}`,
      toolName: "propose_update_deployment",
      toolPayload: {
        proposalId,
        action: {
          dseq: "42",
          after: { command: ["sh", "-c"], args: [`--api-key=${REDACTED}`], env: [{ api_key: `api_key: ${REDACTED}` }] },
          replicas: 3,
          persistent: true
        },
        diagnosis: null
      }
    });
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
