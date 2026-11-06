import type { ProposalActionType } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";

export interface AssistantEvalExpectation {
  calls?: string[];
  neverCalls?: string[];
  proposes?: ProposalActionType;
  proposalMentions?: string[];
  neverProposes?: boolean;
  neverProposesTypes?: ProposalActionType[];
  mentions?: string[];
  neverMentions?: string[];
  neverRepeatsCalls?: boolean;
  neverAdvisesRepricing?: boolean;
}

const REPRICING_ADVICE = [
  /\b(?:rais|increas|bump|boost)\w*\b[^.!?\n]{0,40}\b(?:price|pricing|bid)\b/i,
  /\bhigher (?:price|bid)\b|\bpay more\b|\bwilling to pay\b/i,
  /\b(?:chang|switch|swap)\w*\b[^.!?\n]{0,30}\bdenom/i
];

const ADVICE_AGAINST = /n't\b|\b(?:not|never|no need|instead of|rather than|without)\b/i;

export interface AssistantEvalToolCall {
  name: string;
  arguments: Record<string, unknown>;
  repeated?: boolean;
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

function callFailures(expected: AssistantEvalExpectation, calledNames: Set<string>): string[] {
  const missing = (expected.calls ?? []).filter(name => !calledNames.has(name)).map(name => `did not call ${name}`);
  const forbidden = (expected.neverCalls ?? []).filter(name => calledNames.has(name)).map(name => `called ${name}`);

  return [...missing, ...forbidden];
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
  const forbidden = (expected.neverMentions ?? []).filter(text => includesText(answer, text)).map(text => `answer says "${text}"`);

  return [...missing, ...forbidden];
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
  const calledNames = new Set(transcript.toolCalls.map(({ name }) => name));
  const failures = [
    ...callFailures(expected, calledNames),
    ...proposalFailures(expected, transcript),
    ...answerFailures(expected, transcript.answer),
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
