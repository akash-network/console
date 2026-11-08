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
  tool: string;
  label: string;
  ok: boolean;
}

export interface AssistantVisibleReadChip extends AssistantReadChip {
  retried: boolean;
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

const PROPOSAL_TOOL_PREFIX = "propose_";

const FAILED_READ_LABELS: Record<string, string> = {
  list_deployments: "Could not read your deployments",
  get_deployment: "Could not read the deployment",
  get_bids: "Could not read the bids",
  get_balance_and_spend: "Could not read your balance and spend",
  get_lease_close_reason: "Could not read why the deployment closed",
  list_templates: "Could not search the template gallery",
  search_docs: "Could not search the Console docs",
  check_availability: "Could not check which providers could bid",
  read_logs: "Could not read the logs",
  read_events: "Could not read the events",
  read_configure_form: "Could not read the configure form"
};

const UNKNOWN_FAILED_READ_LABEL = "Could not finish a check";

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
      if (isProposalTool(event.name)) return message;
      return { ...message, reads: [...message.reads, { id: event.toolCallId, tool: event.name, label: readLabelOfTool(event.name), ok: true }] };
    case "tool_result_summary":
      if (isProposalTool(event.name)) return message;
      return {
        ...message,
        reads: upsertRead(message.reads, {
          id: event.toolCallId,
          tool: event.name,
          label: event.ok ? event.summary || readLabelOfTool(event.name) : failedReadLabelOf(event.name),
          ok: event.ok
        })
      };
    case "client_tool_request":
      return { ...message, reads: upsertRead(message.reads, { id: event.toolCallId, tool: event.name, label: readLabelOfClientTool(event), ok: true }) };
    case "action_proposal":
      return { ...message, proposals: [...message.proposals, { proposalId: event.proposalId, action: event.action, diagnosis: event.diagnosis }] };
    case "live_help_suggested":
      return { ...message, liveHelpReason: event.reason };
    default:
      return message;
  }
}

export function readLabelOfClientTool(request: Pick<AssistantClientToolRequest, "name" | "arguments">): string {
  if (request.name === "read_configure_form") return "Read the configure form";

  const kind = request.name === "read_logs" ? "logs" : "events";
  const scope = [request.arguments.service, `last ${request.arguments.tailLines ?? DEFAULT_TAIL_LINES} lines`].filter(Boolean).join(", ");
  return `Read ${kind} (${scope})`;
}

/** Drops a failed read the same tool later got right in this answer, and marks that success as retried. */
export function visibleReadsOf(reads: AssistantReadChip[]): AssistantVisibleReadChip[] {
  return reads.flatMap((read, index) => {
    const isSameTool = (other: AssistantReadChip) => other.tool === read.tool;
    if (!read.ok && reads.slice(index + 1).some(other => isSameTool(other) && other.ok)) return [];

    return [{ ...read, retried: read.ok && reads.slice(0, index).some(other => isSameTool(other) && !other.ok) }];
  });
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
  const subject = name.replace(TOOL_NAME_VERB, "").replace(/_/g, " ");
  return TOOL_NAME_VERB.test(name) ? `Reading ${subject}` : subject.charAt(0).toUpperCase() + subject.slice(1);
}

/** Worded here rather than taken from the api's summary, which older api versions filled with the raw tool name. */
function failedReadLabelOf(tool: string): string {
  return Object.hasOwn(FAILED_READ_LABELS, tool) ? FAILED_READ_LABELS[tool] : UNKNOWN_FAILED_READ_LABEL;
}

function upsertRead(reads: AssistantReadChip[], read: AssistantReadChip): AssistantReadChip[] {
  return reads.some(existing => existing.id === read.id) ? reads.map(existing => (existing.id === read.id ? read : existing)) : [...reads, read];
}
