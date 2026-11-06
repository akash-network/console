import { singleton } from "tsyringe";

import { TxService } from "@src/core/services/tx/tx.service";
import type { AssistantMessageRole } from "@src/feedback/model-schemas";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";

export interface TranscriptEntry {
  role: AssistantMessageRole;
  content: string;
  toolName?: string;
  toolPayload?: Record<string, unknown>;
}

/** Writes only for conversations the user allowed the team to review; callers decide that before calling. */
@singleton()
export class AssistantTranscriptService {
  constructor(
    private readonly assistantMessageRepository: AssistantMessageRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly txService: TxService
  ) {}

  async record(conversationId: string, entry: TranscriptEntry): Promise<void> {
    await this.txService.transaction(async () => {
      await this.assistantMessageRepository.create({ conversationId, ...entry });
      await this.assistantConversationRepository.updateById(conversationId, { lastMessageAt: new Date() });
    });
  }
}
