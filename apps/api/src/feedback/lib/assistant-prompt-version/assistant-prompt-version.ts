import { createHash } from "node:crypto";

import { ASSISTANT_KNOWLEDGE_VERSION } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { ASSISTANT_CONFIGURE_FORM_RULES, ASSISTANT_RULES } from "@src/feedback/lib/assistant-system-prompt/assistant-system-prompt";

const PROMPT_VERSION_LENGTH = 12;

export function assistantPromptVersionOf(parts: { rules: string[]; knowledgeVersion: string }): string {
  return createHash("sha256")
    .update([...parts.rules, parts.knowledgeVersion].join("\n"))
    .digest("hex")
    .slice(0, PROMPT_VERSION_LENGTH);
}

export const ASSISTANT_PROMPT_VERSION = assistantPromptVersionOf({
  rules: [...ASSISTANT_RULES, ...ASSISTANT_CONFIGURE_FORM_RULES],
  knowledgeVersion: ASSISTANT_KNOWLEDGE_VERSION
});
