import type {
  AssistantAction,
  AssistantClientToolRequest,
  AssistantDiagnosis,
  AssistantHistoryMessage,
  AssistantLiveHelpReason,
  AssistantStreamEvent
} from "@src/types/assistant";

export interface AssistantReadChip {
  id: string;
  label: string;
  ok: boolean;
}

export interface AssistantProposal {
  proposalId: string;
  action: AssistantAction;
  diagnosis?: AssistantDiagnosis;
}

export interface AssistantTranscriptMessage {
  id: string;
  role: AssistantHistoryMessage["role"];
  text: string;
  reads: AssistantReadChip[];
  proposals: AssistantProposal[];
  liveHelpReason: AssistantLiveHelpReason | null;
  /** Secrets the api removed from this question before the model saw it; only ever a count, never the value or its kind. */
  redactedSecretCount: number;
}

export interface AssistantTurnMessageIds {
  questionId: string;
  answerId: string;
}

/** The api keeps no more of an unstored conversation than this, so older messages are dropped before they are sent. */
export const MAX_HISTORY_MESSAGES = 20;

const MAX_HISTORY_MESSAGE_LENGTH = 8_000;

const DEFAULT_TAIL_LINES = 200;

const TOOL_NAME_VERB = /^(get|list|read|search)_/;

export function createTranscriptMessage(id: string, role: AssistantTranscriptMessage["role"], text = ""): AssistantTranscriptMessage {
  return { id, role, text, reads: [], proposals: [], liveHelpReason: null, redactedSecretCount: 0 };
}

/** A redaction is about what the user sent, so it marks the question; every other event builds the answer. */
export function applyTurnEvent(
  messages: AssistantTranscriptMessage[],
  ids: AssistantTurnMessageIds,
  event: AssistantStreamEvent
): AssistantTranscriptMessage[] {
  if (event.type === "secret_redacted") {
    return messages.map(message => (message.id === ids.questionId ? { ...message, redactedSecretCount: message.redactedSecretCount + event.count } : message));
  }
  return messages.map(message => (message.id === ids.answerId ? applyAssistantEvent(message, event) : message));
}

export function applyAssistantEvent(message: AssistantTranscriptMessage, event: AssistantStreamEvent): AssistantTranscriptMessage {
  switch (event.type) {
    case "text_delta":
      return { ...message, text: message.text + event.text };
    case "tool_started":
      return { ...message, reads: [...message.reads, { id: event.toolCallId, label: readLabelOfTool(event.name), ok: true }] };
    case "tool_result_summary":
      return { ...message, reads: upsertRead(message.reads, { id: event.toolCallId, label: event.summary || readLabelOfTool(event.name), ok: event.ok }) };
    case "client_tool_request":
      return { ...message, reads: [...message.reads, { id: event.toolCallId, label: readLabelOfClientTool(event), ok: true }] };
    case "action_proposal":
      return { ...message, proposals: [...message.proposals, { proposalId: event.proposalId, action: event.action, diagnosis: event.diagnosis }] };
    case "live_help_suggested":
      return { ...message, liveHelpReason: event.reason };
    default:
      return message;
  }
}

export function readLabelOfClientTool(request: Pick<AssistantClientToolRequest, "name" | "arguments">): string {
  const kind = request.name === "read_logs" ? "logs" : "events";
  const scope = [request.arguments.service, `last ${request.arguments.tailLines ?? DEFAULT_TAIL_LINES} lines`].filter(Boolean).join(", ");
  return `${kind} (${scope})`;
}

export function tailLinesOf(request: Pick<AssistantClientToolRequest, "arguments">): number {
  return request.arguments.tailLines ?? DEFAULT_TAIL_LINES;
}

/** The earlier messages an unstored conversation resends, oldest first, without answers that never got any text. */
export function historyOf(messages: AssistantTranscriptMessage[]): AssistantHistoryMessage[] {
  return messages
    .filter(message => message.text.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => ({ role: message.role, content: message.text.slice(0, MAX_HISTORY_MESSAGE_LENGTH) }));
}

function readLabelOfTool(name: string): string {
  return name.replace(TOOL_NAME_VERB, "").replace(/_/g, " ");
}

function upsertRead(reads: AssistantReadChip[], read: AssistantReadChip): AssistantReadChip[] {
  return reads.some(existing => existing.id === read.id) ? reads.map(existing => (existing.id === read.id ? read : existing)) : [...reads, read];
}
