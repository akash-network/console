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
}

/** The api keeps no more of an unstored conversation than this, so older messages are dropped before they are sent. */
export const MAX_HISTORY_MESSAGES = 20;

const MAX_HISTORY_MESSAGE_LENGTH = 8_000;

const DEFAULT_TAIL_LINES = 200;

const TOOL_NAME_VERB = /^(get|list|read|search)_/;

const PROPOSAL_TOOL_PREFIX = "propose_";

export function createTranscriptMessage(id: string, role: AssistantTranscriptMessage["role"], text = ""): AssistantTranscriptMessage {
  return { id, role, text, reads: [], proposals: [], liveHelpReason: null };
}

export function applyAssistantEvent(message: AssistantTranscriptMessage, event: AssistantStreamEvent): AssistantTranscriptMessage {
  switch (event.type) {
    case "text_delta":
      return { ...message, text: message.text + event.text };
    case "tool_started":
      if (isProposalTool(event.name)) return message;
      return { ...message, reads: [...message.reads, { id: event.toolCallId, label: readLabelOfTool(event.name), ok: true }] };
    case "tool_result_summary":
      if (isProposalTool(event.name)) return message;
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

/** A proposal shows as its action card, so it gets no read chip. */
function isProposalTool(name: string): boolean {
  return name.startsWith(PROPOSAL_TOOL_PREFIX);
}

function readLabelOfTool(name: string): string {
  return name.replace(TOOL_NAME_VERB, "").replace(/_/g, " ");
}

function upsertRead(reads: AssistantReadChip[], read: AssistantReadChip): AssistantReadChip[] {
  return reads.some(existing => existing.id === read.id) ? reads.map(existing => (existing.id === read.id ? read : existing)) : [...reads, read];
}
