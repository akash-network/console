import type { ProposalActionType } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";

export interface AssistantEvalExpectation {
  calls?: string[];
  callsFirst?: string;
  neverCalls?: string[];
  proposes?: ProposalActionType;
  proposalMentions?: string[];
  neverProposes?: boolean;
  neverProposesTypes?: ProposalActionType[];
  mentions?: string[];
  mentionsAnyOf?: string[];
  neverMentions?: string[];
  linksDeployments?: string[];
  neverRepeatsCalls?: boolean;
  neverAdvisesRepricing?: boolean;
}

const REPRICING_ADVICE = [
  /\b(?:rais|increas|bump|boost)\w*\b[^.!?\n]{0,40}\b(?:prices?|pricing|bid)\b/i,
  /\bhigher (?:prices?|bids?)\b|\bpay more\b|\bwilling to pay\b/i,
  /\b(?:chang|switch|swap)\w*\b[^.!?\n]{0,30}\bdenom/i
];

const ADVICE_AGAINST = /n't\b|\b(?:not|never|no need|instead of|rather than|without)\b/i;

export interface AssistantEvalToolCall {
  name: string;
  arguments: Record<string, unknown>;
  repeated?: boolean;
  round?: number;
}

export interface AssistantEvalTranscript {
  toolCalls: AssistantEvalToolCall[];
  answer: string;
  fellBack?: boolean;
}

export interface AssistantEvalResult {
  id: string;
  passed: boolean;
  failures: string[];
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function proposalsOf(transcript: AssistantEvalTranscript): { type: ProposalActionType; arguments: Record<string, unknown> }[] {
  return transcript.toolCalls.flatMap(call => {
    const type = proposalActionTypeOf(call.name);
    return type ? [{ type, arguments: call.arguments }] : [];
  });
}

function firstRoundFailures(callsFirst: string, toolCalls: AssistantEvalToolCall[]): string[] {
  if (toolCalls.length === 0) return [`called nothing before ${callsFirst}`];

  const firstRoundNames = new Set(toolCalls.filter(({ round }) => round === toolCalls[0].round).map(({ name }) => name));
  const order = firstRoundNames.has(callsFirst) ? "alongside" : "before";

  return [...firstRoundNames].filter(name => name !== callsFirst).map(name => `called ${name} ${order} ${callsFirst}`);
}

function callFailures(expected: AssistantEvalExpectation, toolCalls: AssistantEvalToolCall[]): string[] {
  const calledNames = new Set(toolCalls.map(({ name }) => name));
  const missing = (expected.calls ?? []).filter(name => !calledNames.has(name)).map(name => `did not call ${name}`);
  const forbidden = (expected.neverCalls ?? []).filter(name => calledNames.has(name)).map(name => `called ${name}`);
  const notFirst = expected.callsFirst ? firstRoundFailures(expected.callsFirst, toolCalls) : [];

  return [...missing, ...forbidden, ...notFirst];
}

function proposalFailures(expected: AssistantEvalExpectation, transcript: AssistantEvalTranscript): string[] {
  const proposals = proposalsOf(transcript);
  const failures: string[] = [];

  if (expected.neverProposes && proposals.length > 0) failures.push(`proposed ${proposals.map(({ type }) => type).join(", ")}`);

  for (const type of expected.neverProposesTypes ?? []) {
    if (proposals.some(proposal => proposal.type === type)) failures.push(`proposed ${type}`);
  }

  if (expected.proposes) {
    const matching = proposals.filter(({ type }) => type === expected.proposes);
    if (matching.length === 0) return [...failures, `did not propose ${expected.proposes}`];

    const argumentsText = matching.map(proposal => JSON.stringify(proposal.arguments)).join("\n");
    for (const text of expected.proposalMentions ?? []) {
      if (!includesText(argumentsText, text)) failures.push(`${expected.proposes} proposal lacks "${text}"`);
    }
  }

  return failures;
}

function answerFailures(expected: AssistantEvalExpectation, answer: string): string[] {
  const missing = (expected.mentions ?? []).filter(text => !includesText(answer, text)).map(text => `answer lacks "${text}"`);
  const alternatives = expected.mentionsAnyOf ?? [];
  const lacksEveryAlternative = alternatives.length > 0 && !alternatives.some(text => includesText(answer, text));
  const missingAlternative = lacksEveryAlternative ? [`answer lacks any of "${alternatives.join('", "')}"`] : [];
  const forbidden = (expected.neverMentions ?? []).filter(text => includesText(answer, text)).map(text => `answer says "${text}"`);

  return [...missing, ...missingAlternative, ...forbidden];
}

function deploymentLinkOf(dseq: string): string {
  return `](/deployments/${dseq})`;
}

function deploymentLinkFailures(expected: AssistantEvalExpectation, answer: string): string[] {
  return (expected.linksDeployments ?? []).flatMap(dseq => {
    const link = deploymentLinkOf(dseq);
    if (!answer.includes(link)) return [`answer does not link deployment ${dseq}`];

    return answer.split(link).join("").includes(dseq) ? [`answer writes a bare dseq ${dseq}`] : [];
  });
}

function repricingFailures(expected: AssistantEvalExpectation, answer: string): string[] {
  if (!expected.neverAdvisesRepricing) return [];

  return answer
    .split(/(?<=[.!?])\s+|\n+/)
    .filter(sentence => REPRICING_ADVICE.some(advice => advice.test(sentence)) && !ADVICE_AGAINST.test(sentence))
    .map(sentence => `answer advises repricing: "${sentence.trim()}"`);
}

function turnFailures(expected: AssistantEvalExpectation, transcript: AssistantEvalTranscript): string[] {
  const repeated = expected.neverRepeatsCalls ? transcript.toolCalls.filter(call => call.repeated).map(({ name }) => `repeated ${name}`) : [];

  return [...repeated, ...(transcript.fellBack ? ["answered only with the fallback"] : [])];
}

export function scoreAssistantEval(id: string, expected: AssistantEvalExpectation, transcript: AssistantEvalTranscript): AssistantEvalResult {
  const failures = [
    ...callFailures(expected, transcript.toolCalls),
    ...proposalFailures(expected, transcript),
    ...answerFailures(expected, transcript.answer),
    ...deploymentLinkFailures(expected, transcript.answer),
    ...repricingFailures(expected, transcript.answer),
    ...turnFailures(expected, transcript)
  ];

  return { id, passed: failures.length === 0, failures };
}

export function formatAssistantEvalTable(results: AssistantEvalResult[]): string {
  const idWidth = Math.max("case".length, ...results.map(({ id }) => id.length));
  const rows = results.map(({ id, passed, failures }) => `${id.padEnd(idWidth)}  ${passed ? "PASS" : "FAIL"}  ${failures.join("; ")}`.trimEnd());
  const passedCount = results.filter(({ passed }) => passed).length;

  return [`${"case".padEnd(idWidth)}  result`, ...rows, "", `${passedCount}/${results.length} passed`].join("\n");
}
