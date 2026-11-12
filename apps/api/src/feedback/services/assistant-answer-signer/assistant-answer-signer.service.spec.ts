import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { envSchema } from "@src/feedback/config/env.config";
import { MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { AssistantAnswerSigner } from "./assistant-answer-signer.service";

describe(AssistantAnswerSigner.name, () => {
  it("verifies an answer it signed for the same user and conversation", () => {
    const { signer, input } = setup();
    expect(signer.verifies({ ...input, signature: signer.sign(input) })).toBe(true);
  });

  it("signs with a 43 character base64url HMAC", () => {
    const { signer, input } = setup();
    expect(signer.sign(input)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects the signature for another conversation, another user or edited text", () => {
    const { signer, input } = setup();
    const signature = signer.sign(input);
    expect(signer.verifies({ ...input, conversationId: faker.string.uuid(), signature })).toBe(false);
    expect(signer.verifies({ ...input, userId: faker.string.uuid(), signature })).toBe(false);
    expect(signer.verifies({ ...input, text: `${input.text}.`, signature })).toBe(false);
  });

  it("rejects a signature made with another key", () => {
    const { signer, input } = setup();
    const { signer: otherSigner } = setup({ key: faker.string.alphanumeric(40) });
    expect(signer.verifies({ ...input, signature: otherSigner.sign(input) })).toBe(false);
  });

  it("signs only the part of a long answer the browser sends back", () => {
    const { signer, input } = setup({ text: "a".repeat(MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH + 500) });
    const signature = signer.sign(input);
    expect(signer.verifies({ ...input, text: input.text.slice(0, MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH), signature })).toBe(true);
    expect(signer.verifies({ ...input, text: input.text.slice(0, MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH - 1), signature })).toBe(false);
  });

  it("returns false for a signature of the wrong length or alphabet instead of throwing", () => {
    const { signer, input } = setup();
    expect(signer.verifies({ ...input, signature: "short" })).toBe(false);
    expect(signer.verifies({ ...input, signature: "!".repeat(43) })).toBe(false);
  });

  it("is configured with a key", () => {
    expect(setup().signer.isConfigured()).toBe(true);
  });

  it("is not configured without a key", () => {
    expect(setup({ key: undefined }).signer.isConfigured()).toBe(false);
  });

  it("refuses to sign without a key", () => {
    const { signer, input } = setup({ key: undefined });
    expect(() => signer.sign(input)).toThrow("ASSISTANT_HISTORY_SIGNING_KEY is not set");
  });

  it("verifies nothing without a key instead of throwing", () => {
    const { signer: keyedSigner, input } = setup();
    const { signer } = setup({ key: undefined });
    expect(signer.verifies({ ...input, signature: keyedSigner.sign(input) })).toBe(false);
  });

  function setup(input: { key?: string; text?: string } = {}) {
    const key = "key" in input ? input.key : faker.string.alphanumeric(40);
    const config = envSchema.parse({ ASSISTANT_HISTORY_SIGNING_KEY: key });
    const signer = new AssistantAnswerSigner(config);

    return {
      signer,
      input: { userId: faker.string.uuid(), conversationId: faker.string.uuid(), text: input.text ?? faker.lorem.paragraph() }
    };
  }
});
