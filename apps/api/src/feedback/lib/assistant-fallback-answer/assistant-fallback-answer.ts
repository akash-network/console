import { toolCallsOfCurrentTurn, type TurnToolCall } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";

const DSEQ_PATTERN = /^[1-9]\d{0,19}$/;
const MENTIONS_A_DEPLOYMENT_PATTERN = /\b(deployments?|dseq|lease|container|service|app|site)\b/i;

const ACCOUNT_READS: Record<string, string> = {
  list_deployments: "your deployments",
  get_balance_and_spend: "your balance and spend",
  list_templates: "the template gallery",
  search_docs: "the Console docs"
};

const DEPLOYMENT_READS: Record<string, (dseq: string) => string> = {
  get_deployment: dseq => `deployment ${dseq}`,
  get_bids: dseq => `the bids on deployment ${dseq}`,
  get_lease_close_reason: dseq => `why deployment ${dseq} closed`,
  read_logs: dseq => `the logs of deployment ${dseq}`,
  read_events: dseq => `the events of deployment ${dseq}`
};

const READ_SHOWS_NO_BIDS: Record<string, (data: Record<string, unknown>) => boolean> = {
  get_bids: data => isEmptyList(data.bids) && data.leaseCount === 0,
  get_lease_close_reason: data => isEmptyList(data.leases)
};

interface Read {
  phrase: string;
  dseq?: string;
  showsNoBids: boolean;
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function dataOf(result: string | undefined): Record<string, unknown> | undefined {
  try {
    return JSON.parse(result ?? "").data;
  } catch {
    return undefined;
  }
}

function showsNoBids(name: string, result: string | undefined): boolean {
  const data = dataOf(result);
  return !!data && Object.hasOwn(READ_SHOWS_NO_BIDS, name) && READ_SHOWS_NO_BIDS[name](data);
}

function dseqOf(call: ChatToolCall): string | undefined {
  try {
    const { dseq } = JSON.parse(call.function.arguments || "{}");
    return typeof dseq === "string" && DSEQ_PATTERN.test(dseq) ? dseq : undefined;
  } catch {
    return undefined;
  }
}

function readOf({ call, result }: TurnToolCall): Read | undefined {
  const name = call.function.name;
  if (Object.hasOwn(ACCOUNT_READS, name)) return { phrase: ACCOUNT_READS[name], showsNoBids: false };

  const dseq = dseqOf(call);
  return Object.hasOwn(DEPLOYMENT_READS, name) && dseq ? { phrase: DEPLOYMENT_READS[name](dseq), dseq, showsNoBids: showsNoBids(name, result) } : undefined;
}

function listOf(phrases: string[]): string {
  return phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

function questionOf(messages: ChatMessage[]): string {
  const question = messages.findLast(message => message.role === "user");
  return question?.content ?? "";
}

function looksLikePastedSdl(question: string): boolean {
  const lines = question.split("\n").map(line => line.trim());
  const services = lines.indexOf("services:");
  return services !== -1 && lines.indexOf("profiles:", services) !== -1;
}

function nextStepOf(reads: Read[], question: string): string {
  const withoutBids = reads.findLast(read => read.showsNoBids);
  if (withoutBids)
    return `Next step: ask "Why no bids on deployment ${withoutBids.dseq}?", or redeploy it from the deployment editor with changed requirements.`;

  const deployment = reads.findLast(read => read.dseq);
  if (deployment) return `Next step: tell me what you expected deployment ${deployment.dseq} to do, or ask on Discord for live help.`;

  if (looksLikePastedSdl(question))
    return "Next step: paste the SDL into Import SDL on the new deployment page, which validates it as you paste, or ask about one service at a time.";

  if (MENTIONS_A_DEPLOYMENT_PATTERN.test(question)) return "Next step: tell me which deployment you mean, or ask on Discord for live help.";

  return "Next step: ask again in a shorter question, or ask on Discord for live help.";
}

/** The last resort when the model returns no visible answer twice, so a turn never ends on read chips alone. */
export function fallbackAnswerOf(messages: ChatMessage[]): string {
  const reads = toolCallsOfCurrentTurn(messages)
    .map(readOf)
    .filter((read): read is Read => read !== undefined);
  const phrases = [...new Set(reads.map(({ phrase }) => phrase))];
  const whatWasRead = phrases.length > 0 ? `I read ${listOf(phrases)}, but could not finish my answer.` : "I could not finish my answer this time.";

  return `${whatWasRead} ${nextStepOf(reads, questionOf(messages))}`;
}
