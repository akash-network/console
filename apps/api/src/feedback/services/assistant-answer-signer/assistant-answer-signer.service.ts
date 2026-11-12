import { createHmac, timingSafeEqual } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";

const SIGNATURE_PURPOSE = "assistant-answer-v1";

type AssistantAnswer = { userId: string; conversationId: string; text: string };

/** Signs only the prefix the browser may send back, since the history schema caps each resent message at that length. */
@singleton()
export class AssistantAnswerSigner {
  constructor(@inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig) {}

  isConfigured(): boolean {
    return !!this.config.ASSISTANT_HISTORY_SIGNING_KEY;
  }

  sign({ userId, conversationId, text }: AssistantAnswer): string {
    const key = this.config.ASSISTANT_HISTORY_SIGNING_KEY;
    if (!key) throw new Error("ASSISTANT_HISTORY_SIGNING_KEY is not set");

    return createHmac("sha256", key)
      .update(JSON.stringify([SIGNATURE_PURPOSE, userId, conversationId, text.slice(0, MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH)]))
      .digest("base64url");
  }

  verifies({ signature, ...answer }: AssistantAnswer & { signature: string }): boolean {
    if (!this.isConfigured()) return false;

    const expected = Buffer.from(this.sign(answer));
    const given = Buffer.from(signature);

    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
