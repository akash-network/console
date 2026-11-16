import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import { ASSISTANT_MESSAGE_FLAG_SCHEMA, buildMessageFlagMessages } from "@src/feedback/lib/assistant-message-flag-prompt/assistant-message-flag-prompt";
import { type AkashMlClient, AkashMlOutputError, AkashMlRequestError } from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantMessageFlagger, MESSAGE_FLAG_TIMEOUT_MS } from "./assistant-message-flagger.service";

describe(AssistantMessageFlagger.name, () => {
  it("labels the message with the feedback classifier model, at temperature 0 and within its own timeout", async () => {
    const { flagger, akashMlClient } = setup();
    akashMlClient.completeJson.mockResolvedValue("off_topic");

    const message = { message: "write me a poem", earlierUserMessages: ["hi"] };

    expect(await flagger.flag(message)).toBe("off_topic");
    expect(akashMlClient.completeJson).toHaveBeenCalledWith(
      { model: "classifier-model", messages: buildMessageFlagMessages(message), schema: ASSISTANT_MESSAGE_FLAG_SCHEMA, temperature: 0 },
      { timeoutMs: MESSAGE_FLAG_TIMEOUT_MS }
    );
  });

  it("answers null without a model call when AkashML is not configured", async () => {
    const { flagger, akashMlClient } = setup();
    akashMlClient.isAvailable.mockReturnValue(false);

    expect(await flagger.flag({ message: "hi", earlierUserMessages: [] })).toBeNull();
    expect(akashMlClient.completeJson).not.toHaveBeenCalled();
  });

  it.each([
    new AkashMlRequestError("AkashML answered 503", 503),
    new AkashMlOutputError("AkashML answered without a JSON object"),
    new Error("socket hang up")
  ])("answers null and logs when the call fails with $name", async error => {
    const { flagger, akashMlClient, logger } = setup();
    akashMlClient.completeJson.mockRejectedValue(error);

    expect(await flagger.flag({ message: "hi", earlierUserMessages: [] })).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_MESSAGE_FLAG_FAILED", error });
  });

  function setup() {
    const akashMlClient = mock<AkashMlClient>();
    akashMlClient.isAvailable.mockReturnValue(true);
    const logger = mock<ReturnType<CreateLogger>>();
    const flagger = new AssistantMessageFlagger(
      akashMlClient,
      envSchema.parse({ FEEDBACK_CLASSIFIER_MODEL: "classifier-model" }),
      vi.fn<CreateLogger>(() => logger)
    );

    return { flagger, akashMlClient, logger };
  }
});
