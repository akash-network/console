import { MAX_ASSISTANT_HISTORY_MESSAGES } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { AssistantMessageRole } from "@src/feedback/model-schemas";
import type { ChatMessage } from "@src/feedback/services/akashml-client/akashml.client";

export const MAX_HISTORY_LENGTH = 24_000;
export const ACTION_RESULT_TOOL_NAME = "action_result";

type HistoryMessage = { role: "user" | "assistant"; content: string };

interface StoredMessage {
  role: AssistantMessageRole;
  content: string;
  toolName: string | null;
}

/** Keeps the latest messages that fit, since the end of a conversation matters most to the next answer. */
function bounded(messages: HistoryMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let length = 0;

  for (const message of messages.slice(-MAX_ASSISTANT_HISTORY_MESSAGES).reverse()) {
    length += message.content.length;
    if (length > MAX_HISTORY_LENGTH) break;

    kept.unshift({ role: message.role, content: redactSecrets(message.content) });
  }

  return kept;
}

function historyMessageOf({ role, content, toolName }: StoredMessage): HistoryMessage | null {
  if (role !== "tool") return { role, content };
  if (toolName === ACTION_RESULT_TOOL_NAME) return { role: "user", content: `[Action card outcome reported by Console] ${content}` };
  if (toolName?.startsWith("propose_")) return { role: "assistant", content: `[Card shown to the user] ${content}` };

  return null;
}

export function historyFromStored(messages: StoredMessage[]): ChatMessage[] {
  return bounded(messages.map(historyMessageOf).filter((message): message is HistoryMessage => message !== null));
}

export function historyFromClient(messages: HistoryMessage[] | undefined): ChatMessage[] {
  return bounded(messages ?? []);
}
