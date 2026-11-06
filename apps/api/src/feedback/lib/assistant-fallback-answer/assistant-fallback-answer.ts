import { toolCallsOfCurrentTurn } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";

const DSEQ_PATTERN = /^[1-9]\d{0,19}$/;

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

const READS_OF_A_DEPLOYMENT_WITHOUT_BIDS = new Set(["get_bids", "get_lease_close_reason"]);

interface Read {
  name: string;
  phrase: string;
  dseq?: string;
}

function dseqOf(call: ChatToolCall): string | undefined {
  try {
    const { dseq } = JSON.parse(call.function.arguments || "{}");
    return typeof dseq === "string" && DSEQ_PATTERN.test(dseq) ? dseq : undefined;
  } catch {
    return undefined;
  }
}

function readOf(call: ChatToolCall): Read | undefined {
  const name = call.function.name;
  if (Object.hasOwn(ACCOUNT_READS, name)) return { name, phrase: ACCOUNT_READS[name] };

  const dseq = dseqOf(call);
  return Object.hasOwn(DEPLOYMENT_READS, name) && dseq ? { name, phrase: DEPLOYMENT_READS[name](dseq), dseq } : undefined;
}

function listOf(phrases: string[]): string {
  return phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

function nextStepOf(reads: Read[]): string {
  const withoutBids = reads.findLast(read => READS_OF_A_DEPLOYMENT_WITHOUT_BIDS.has(read.name));
  if (withoutBids)
    return `Next step: ask "Why no bids on deployment ${withoutBids.dseq}?", or redeploy it from the deployment editor with changed requirements.`;

  const deployment = reads.findLast(read => read.dseq);
  if (deployment) return `Next step: tell me what you expected deployment ${deployment.dseq} to do, or ask on Discord for live help.`;

  return "Next step: tell me which deployment you mean, or ask on Discord for live help.";
}

/** The last resort when the model returns no visible answer twice, so a turn never ends on read chips alone. */
export function fallbackAnswerOf(messages: ChatMessage[]): string {
  const reads = toolCallsOfCurrentTurn(messages)
    .map(({ call }) => readOf(call))
    .filter((read): read is Read => read !== undefined);
  const phrases = [...new Set(reads.map(({ phrase }) => phrase))];
  const whatWasRead = phrases.length > 0 ? `I read ${listOf(phrases)}, but could not finish my answer.` : "I could not finish my answer this time.";

  return `${whatWasRead} ${nextStepOf(reads)}`;
}
