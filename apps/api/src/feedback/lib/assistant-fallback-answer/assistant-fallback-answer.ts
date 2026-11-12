import { toolCallsOfCurrentTurn, type TurnToolCall } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";

const DSEQ_PATTERN = /^[1-9]\d{0,19}$/;
const NAMES_AN_EXISTING_DEPLOYMENT_PATTERN =
  /\b(?:my|this|that|our)\s+(?:deployments?|leases?|containers?|services?|apps?|sites?)\b|\bdseq\b|\bdeployment\s+#?\d/i;

const ACCOUNT_READS: Record<string, string> = {
  list_deployments: "your deployments",
  get_balance_and_spend: "your balance and spend",
  list_templates: "the template gallery",
  search_docs: "the Console docs",
  read_configure_form: "the configure form"
};

const DEPLOYMENT_READS: Record<string, (deployment: string) => string> = {
  get_deployment: deployment => deployment,
  get_bids: deployment => `the bids on ${deployment}`,
  get_lease_close_reason: deployment => `why ${deployment} closed`,
  read_logs: deployment => `the logs of ${deployment}`,
  read_events: deployment => `the events of ${deployment}`
};

const READ_SHOWS_NO_BIDS: Record<string, (data: Record<string, unknown>) => boolean> = {
  get_bids: data => isEmptyList(data.bids) && data.leaseCount === 0,
  get_lease_close_reason: data => isEmptyList(data.leases)
};

interface Read {
  phrase: string;
  deployment?: { name: string | null };
  showsNoBids: boolean;
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function dataOf(result: string | undefined): Record<string, unknown> | undefined {
  try {
    return JSON.parse(result ?? "").untrustedData;
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

/** A read asked for again carries the earlier tool result, with its own tool name, as its untrusted data. */
function isFailedEarlierResult(untrustedData: { tool?: unknown; error?: unknown } | null | undefined): boolean {
  return typeof untrustedData?.tool === "string" && untrustedData.error !== undefined;
}

function isFailedRead(result: string | undefined): boolean {
  try {
    const { error, untrustedData } = JSON.parse(result ?? "{}");
    return error !== undefined || isFailedEarlierResult(untrustedData);
  } catch {
    return false;
  }
}

function deploymentNamesIn(value: unknown): [string, string][] {
  if (!value || typeof value !== "object") return [];

  const { dseq, name } = value as Record<string, unknown>;
  const own: [string, string][] = typeof dseq === "string" && typeof name === "string" && name ? [[dseq, name]] : [];
  return [...own, ...Object.values(value).flatMap(deploymentNamesIn)];
}

/** Gathers names from every read in the conversation, since a read of logs or events returns none of its own. */
function deploymentNamesOf(messages: ChatMessage[]): Map<string, string> {
  return new Map(messages.flatMap(message => (message.role === "tool" ? deploymentNamesIn(dataOf(message.content)) : [])));
}

function deploymentLabelOf(name: string | null | undefined, owner: "your" | "my"): string {
  return name ? `deployment ${name}` : `${owner} deployment`;
}

function readOf({ call, result }: TurnToolCall, deploymentNames: Map<string, string>): Read | undefined {
  if (isFailedRead(result)) return undefined;

  const name = call.function.name;
  if (Object.hasOwn(ACCOUNT_READS, name)) return { phrase: ACCOUNT_READS[name], showsNoBids: false };

  const dseq = dseqOf(call);
  if (!Object.hasOwn(DEPLOYMENT_READS, name) || !dseq) return undefined;

  const deployment = { name: deploymentNames.get(dseq) ?? null };
  return { phrase: DEPLOYMENT_READS[name](deploymentLabelOf(deployment.name, "your")), deployment, showsNoBids: showsNoBids(name, result) };
}

function listOf(phrases: string[]): string {
  return phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

function questionOf(messages: ChatMessage[]): string {
  const question = messages.findLast(message => message.role === "user");
  return question?.content ?? "";
}

function looksLikePastedSdl(question: string): boolean {
  const lines = new Set(question.split("\n").map(line => line.trim()));
  return lines.has("services:") && lines.has("profiles:");
}

function nextStepOf(reads: Read[], question: string): string {
  const withoutBids = reads.findLast(read => read.showsNoBids);
  if (withoutBids)
    return `Next step: ask "Why no bids on ${deploymentLabelOf(withoutBids.deployment?.name, "my")}?", or redeploy it from the deployment editor with changed requirements.`;

  if (reads.some(read => read.phrase === ACCOUNT_READS.read_configure_form))
    return "Next step: ask me again which setting to change in the form, or ask on Discord for live help.";

  const deployment = reads.findLast(read => read.deployment)?.deployment;
  if (deployment) return `Next step: tell me what you expected ${deploymentLabelOf(deployment.name, "your")} to do, or ask on Discord for live help.`;

  if (looksLikePastedSdl(question))
    return "Next step: paste the SDL into Import SDL on the new deployment page, which validates it as you paste, or ask about one service at a time.";

  if (NAMES_AN_EXISTING_DEPLOYMENT_PATTERN.test(question)) return "Next step: tell me which deployment you mean, or ask on Discord for live help.";

  return "Next step: ask again in a shorter question, or ask on Discord for live help.";
}

/** The last resort when the model returns no visible answer twice, so a turn never ends on read chips alone. */
export function fallbackAnswerOf(messages: ChatMessage[]): string {
  const deploymentNames = deploymentNamesOf(messages);
  const reads = toolCallsOfCurrentTurn(messages)
    .map(call => readOf(call, deploymentNames))
    .filter((read): read is Read => read !== undefined);
  const phrases = [...new Set(reads.map(({ phrase }) => phrase))];
  const whatWasRead = phrases.length > 0 ? `I read ${listOf(phrases)}, but could not finish my answer.` : "I could not finish my answer this time.";

  return `${whatWasRead} ${nextStepOf(reads, questionOf(messages))}`;
}
