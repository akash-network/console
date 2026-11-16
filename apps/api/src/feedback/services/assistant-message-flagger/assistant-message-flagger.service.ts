import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  ASSISTANT_MESSAGE_FLAG_SCHEMA,
  buildMessageFlagMessages,
  type MessageToFlag
} from "@src/feedback/lib/assistant-message-flag-prompt/assistant-message-flag-prompt";
import type { AssistantTurnFlag } from "@src/feedback/model-schemas/assistant-turn-trace/assistant-turn-trace.schema";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";

export const MESSAGE_FLAG_TIMEOUT_MS = 20_000;

/** Never rejects and answers null when it cannot label, since a turn must never fail or wait on its flag. */
@singleton()
export class AssistantMessageFlagger {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly akashMlClient: AkashMlClient,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantMessageFlagger.name });
  }

  async flag(message: MessageToFlag): Promise<AssistantTurnFlag | null> {
    if (!this.akashMlClient.isAvailable()) return null;

    try {
      return await this.akashMlClient.completeJson(
        { model: this.config.FEEDBACK_CLASSIFIER_MODEL, messages: buildMessageFlagMessages(message), schema: ASSISTANT_MESSAGE_FLAG_SCHEMA, temperature: 0 },
        { timeoutMs: MESSAGE_FLAG_TIMEOUT_MS }
      );
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_MESSAGE_FLAG_FAILED", error });
      return null;
    }
  }
}
