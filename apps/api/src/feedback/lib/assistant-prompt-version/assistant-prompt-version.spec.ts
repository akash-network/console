import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ASSISTANT_KNOWLEDGE_VERSION } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { ASSISTANT_CONFIGURE_FORM_RULES, ASSISTANT_RULES } from "@src/feedback/lib/assistant-system-prompt/assistant-system-prompt";
import { ASSISTANT_PROMPT_VERSION, assistantPromptVersionOf } from "./assistant-prompt-version";

describe(assistantPromptVersionOf.name, () => {
  it("is 12 hex characters", () => {
    expect(ASSISTANT_PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is computed from every assistant rule and the knowledge version", () => {
    expect(ASSISTANT_PROMPT_VERSION).toBe(
      assistantPromptVersionOf({ rules: [...ASSISTANT_RULES, ...ASSISTANT_CONFIGURE_FORM_RULES], knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION })
    );
  });

  it("takes the first 12 characters of a sha256 over the rules, one per line, then the knowledge version", () => {
    const expected = createHash("sha256").update("first rule\nsecond rule\nknowledge-1").digest("hex").slice(0, 12);

    expect(assistantPromptVersionOf({ rules: ["first rule", "second rule"], knowledgeVersion: "knowledge-1" })).toBe(expected);
  });

  it("changes when a rule changes", () => {
    const before = assistantPromptVersionOf({ rules: ["first rule", "second rule"], knowledgeVersion: "knowledge-1" });
    const after = assistantPromptVersionOf({ rules: ["first rule", "second rule, reworded"], knowledgeVersion: "knowledge-1" });

    expect(after).not.toBe(before);
  });

  it("changes when the knowledge version changes", () => {
    const before = assistantPromptVersionOf({ rules: ["first rule"], knowledgeVersion: "knowledge-1" });
    const after = assistantPromptVersionOf({ rules: ["first rule"], knowledgeVersion: "knowledge-2" });

    expect(after).not.toBe(before);
  });

  it("is stable for the same input", () => {
    const parts = { rules: ["first rule", "second rule"], knowledgeVersion: "knowledge-1" };

    expect(assistantPromptVersionOf({ ...parts })).toBe(assistantPromptVersionOf({ ...parts }));
  });
});
