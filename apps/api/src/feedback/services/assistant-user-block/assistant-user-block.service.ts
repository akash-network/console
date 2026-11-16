import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { writeTraceQuietly } from "@src/feedback/lib/assistant-turn-trace/assistant-turn-trace";
import type { AssistantTurnFlag } from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import { AssistantUserBlockRepository } from "@src/feedback/repositories/assistant-user-block/assistant-user-block.repository";
import { AssistantUserUsageRepository } from "@src/feedback/repositories/assistant-user-usage/assistant-user-usage.repository";
import { NotifyAssistantUserBlock } from "@src/feedback/services/notify-assistant-user-block/notify-assistant-user-block.handler";

export interface FlaggedTurn {
  userId: string;
  turnId: string | undefined;
  sentAt: Date;
  flag: AssistantTurnFlag | null;
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextUtcMidnightAfter(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

@singleton()
export class AssistantUserBlockService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly assistantUserBlockRepository: AssistantUserBlockRepository,
    private readonly assistantUserUsageRepository: AssistantUserUsageRepository,
    private readonly assistantTurnTraceRepository: AssistantTurnTraceRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantUserBlockService.name });
  }

  async isBlocked(userId: string): Promise<boolean> {
    return await this.assistantUserBlockRepository.isBlocked(userId, new Date());
  }

  /** Runs once the turn already answered, so it never throws and only logs what it could not record. */
  async recordFlag({ userId, turnId, sentAt, flag }: FlaggedTurn): Promise<void> {
    if (!flag) return;

    if (turnId) await writeTraceQuietly(this.#logger, () => this.assistantTurnTraceRepository.flag(turnId, flag));
    if (flag === "on_topic") return;

    try {
      await this.#countFlaggedTurn(userId, sentAt);
    } catch (error) {
      this.#logger.error({ event: "ASSISTANT_FLAGGED_TURN_NOT_COUNTED", error });
    }
  }

  /** Counts on the day the turn was sent but blocks until the midnight after now, since the label can land after the day it counts on ended. */
  async #countFlaggedTurn(userId: string, sentAt: Date): Promise<void> {
    const flaggedTurnCount = await this.assistantUserUsageRepository.countFlaggedTurn(userId, dayOf(sentAt));
    if (flaggedTurnCount < this.config.ASSISTANT_DAILY_FLAGGED_TURN_LIMIT) return;

    await this.txService.transaction(async () => {
      const block = await this.assistantUserBlockRepository.createAutomatic({ userId, blockedUntil: nextUtcMidnightAfter(new Date()), flaggedTurnCount });
      if (!block) return;

      await this.jobQueueService.enqueue(new NotifyAssistantUserBlock({ blockId: block.id }));
      this.#logger.info({ event: "ASSISTANT_USER_BLOCKED", blockId: block.id, source: block.source, blockedUntil: block.blockedUntil });
    });
  }
}
