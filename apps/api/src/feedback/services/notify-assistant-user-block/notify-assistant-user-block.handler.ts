import { singleton } from "tsyringe";

import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { AssistantUserBlockRepository } from "@src/feedback/repositories/assistant-user-block/assistant-user-block.repository";
import { AssistantSlackNotifier } from "@src/feedback/services/assistant-slack-notifier/assistant-slack-notifier.service";
import { buildUserBlockSlackMessage } from "./user-block-slack-message";

export class NotifyAssistantUserBlock implements Job {
  static readonly [JOB_NAME] = "NotifyAssistantUserBlock";
  readonly name = NotifyAssistantUserBlock[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { blockId: string }) {}
}

@singleton()
export class NotifyAssistantUserBlockHandler implements JobHandler<NotifyAssistantUserBlock> {
  public readonly accepts = NotifyAssistantUserBlock;

  constructor(
    private readonly assistantUserBlockRepository: AssistantUserBlockRepository,
    private readonly assistantSlackNotifier: AssistantSlackNotifier
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ blockId }: JobPayload<NotifyAssistantUserBlock>): Promise<void> {
    const block = await this.assistantUserBlockRepository.findById(blockId);
    if (!block) return;

    const message = buildUserBlockSlackMessage({
      block,
      adminConversationsUrl: this.assistantSlackNotifier.adminUrlOf(`/assistant/conversations?userId=${block.userId}`)
    });

    await this.assistantSlackNotifier.post(message, { blockId });
  }
}
