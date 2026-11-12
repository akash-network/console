import { z } from "zod";

import { MAX_ASSISTANT_HISTORY_MESSAGES } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { AssistantMessageRole } from "@src/feedback/model-schemas";
import type { ChatMessage } from "@src/feedback/services/akashml-client/akashml.client";

export const MAX_HISTORY_LENGTH = 24_000;
export const ACTION_RESULT_TOOL_NAME = "action_result";
export const MAX_RECENT_ACTIONS = 3;
export const MAX_RECENT_ACTION_NAME_LENGTH = 60;

const ActionResultPayloadSchema = z.object({
  proposalId: z.string(),
  actionType: z.string(),
  decision: z.string(),
  outcome: z.string().nullish()
});

const ProposalPayloadSchema = z.object({
  proposalId: z.string(),
  action: z.object({ dseq: z.string().nullish(), name: z.string().nullish() })
});

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

interface StoredToolMessage {
  toolName: string | null;
  toolPayload: Record<string, unknown> | null;
  createdAt: Date;
}

function targetOf(action: z.infer<typeof ProposalPayloadSchema>["action"] | undefined): string {
  if (action?.dseq) return ` on deployment ${action.dseq}`;
  return action?.name ? ` named ${JSON.stringify(redactSecrets(action.name).slice(0, MAX_RECENT_ACTION_NAME_LENGTH))}` : "";
}

function minuteOf(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Lands in the system prompt, so it leaves out the error text the browser reports and cuts the card name short. */
export function recentActionsOf(messages: StoredToolMessage[]): string[] {
  const proposedActions = new Map(
    messages.flatMap(({ toolName, toolPayload }) => {
      const proposal = toolName?.startsWith("propose_") ? ProposalPayloadSchema.safeParse(toolPayload) : undefined;
      return proposal?.success ? [[proposal.data.proposalId, proposal.data.action] as const] : [];
    })
  );

  return messages
    .flatMap(({ toolName, toolPayload, createdAt }) => {
      const result = toolName === ACTION_RESULT_TOOL_NAME ? ActionResultPayloadSchema.safeParse(toolPayload) : undefined;
      if (!result?.success) return [];

      const { proposalId, actionType, decision, outcome } = result.data;
      const status = [decision, outcome].filter(Boolean).join(", ");
      return [redactSecrets(`${actionType.replaceAll("_", " ")}${targetOf(proposedActions.get(proposalId))}: ${status} at ${minuteOf(createdAt)}`)];
    })
    .slice(-MAX_RECENT_ACTIONS);
}

export function historyFromStored(messages: StoredMessage[]): ChatMessage[] {
  return bounded(messages.map(historyMessageOf).filter((message): message is HistoryMessage => message !== null));
}

export function historyFromClient(messages: HistoryMessage[] | undefined): ChatMessage[] {
  return bounded(messages ?? []);
}
