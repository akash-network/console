import "reflect-metadata";
import "@akashnetwork/env-loader";
import "@src/routers/open-api-handlers";

import { readFileSync, writeFileSync } from "node:fs";
import { container } from "tsyringe";

import { stripHiddenOperations } from "@src/core/lib/create-route/create-route";
import { ASSISTANT_EVAL_CASES, type AssistantEvalCase } from "@src/feedback/lib/assistant-eval/assistant-eval-cases";
import {
  type AssistantEvalResult,
  type AssistantEvalToolCall,
  formatAssistantEvalTable,
  scoreAssistantEval
} from "@src/feedback/lib/assistant-eval/assistant-eval-scoring";
import { fallbackAnswerOf } from "@src/feedback/lib/assistant-fallback-answer/assistant-fallback-answer";
import { assistantKnowledge } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { buildAssistantSystemPrompt } from "@src/feedback/lib/assistant-system-prompt/assistant-system-prompt";
import { assistantChatToolsFor, isLiveHelpToolName, proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { earlierResultOf } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
import { consoleApiCatalogOf, consoleApiRoutesOf } from "@src/feedback/lib/console-api-catalog/console-api-catalog";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { AkashMlClient, type ChatMessage, type ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { toolContentOf } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import {
  alreadyReadContentOf,
  ANSWER_NOW_NOTE,
  MAX_COMPLETION_TOKENS,
  MAX_TOOL_ROUNDS,
  requestMessagesFor
} from "@src/feedback/services/assistant-turn/assistant-turn.service";

const COMPLETION_TIMEOUT_MS = 90_000;

const akashMlClient = container.resolve(AkashMlClient);
const config = container.resolve(FEEDBACK_CONFIG);
const outFile = process.env.ASSISTANT_EVAL_OUT;
const maxCompletionTokens = Number(process.env.ASSISTANT_EVAL_MAX_COMPLETION_TOKENS) || MAX_COMPLETION_TOKENS;
const committedDocument = JSON.parse(readFileSync("swagger/openapi.json", "utf8"));
const consoleApiCatalog = consoleApiCatalogOf(consoleApiRoutesOf({ ...committedDocument, paths: stripHiddenOperations(committedDocument.paths) }));

interface CaseMetrics {
  model: string;
  completions: number;
  toolCalls: string[];
  finishReasons: (string | null)[];
  emptyAnswer: boolean;
  firstTokenMs: number | null;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  answer: string;
}

type CaseRun = AssistantEvalResult & Partial<CaseMetrics>;

function newMetrics(): CaseMetrics {
  return {
    model: config.ASSISTANT_MODEL,
    completions: 0,
    toolCalls: [],
    finishReasons: [],
    emptyAnswer: false,
    firstTokenMs: null,
    totalMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    answer: ""
  };
}

function argumentsOf(call: ChatToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.function.arguments);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const SHOWN_CARD = { shown: true, note: "The user sees a card and decides; nothing ran yet." };

function toolMessageOf(evalCase: AssistantEvalCase, call: ChatToolCall, proposalResults: Map<string, unknown[]>): ChatMessage {
  const name = call.function.name;
  const result = evalCase.toolResults?.[name];
  const fixture =
    (typeof result === "function" ? result(argumentsOf(call)) : result) ??
    (name === "search_docs" ? assistantKnowledge.search(String(argumentsOf(call).query ?? "")) : undefined);
  const toolError = evalCase.toolErrors?.[name];
  const payload =
    proposalActionTypeOf(name) || isLiveHelpToolName(name)
      ? { data: proposalResults.get(name)?.shift() ?? SHOWN_CARD }
      : toolError !== undefined
        ? { error: toolError }
        : fixture !== undefined
          ? { data: fixture }
          : { error: "No data for this tool in this case." };

  return { role: "tool", tool_call_id: call.id, content: toolContentOf(name, payload) };
}

interface CaseRequest {
  isFinalRound: boolean;
  configureFormOpen: boolean;
}

async function complete(messages: ChatMessage[], { isFinalRound, configureFormOpen }: CaseRequest, metrics: CaseMetrics, startedAt: number) {
  const completion = await akashMlClient.streamChatCompletion(
    {
      model: config.ASSISTANT_MODEL,
      messages,
      tools: assistantChatToolsFor({ configureFormOpen, consoleApiCatalog }),
      tool_choice: isFinalRound ? "none" : "auto",
      max_completion_tokens: maxCompletionTokens,
      reasoning_effort: config.ASSISTANT_REASONING_EFFORT
    },
    {
      timeoutMs: COMPLETION_TIMEOUT_MS,
      onContentDelta: async text => {
        if (metrics.firstTokenMs === null && text.trim()) metrics.firstTokenMs = Date.now() - startedAt;
      }
    }
  );
  metrics.completions++;
  metrics.finishReasons.push(completion.finishReason);
  metrics.promptTokens += completion.usage?.promptTokens ?? 0;
  metrics.completionTokens += completion.usage?.completionTokens ?? 0;

  return completion;
}

async function answerNow(
  messages: ChatMessage[],
  configureFormOpen: boolean,
  metrics: CaseMetrics,
  startedAt: number
): Promise<{ text: string; fellBack: boolean }> {
  const { content } = await complete([...messages, ANSWER_NOW_NOTE], { isFinalRound: true, configureFormOpen }, metrics, startedAt);
  return content?.trim() ? { text: content, fellBack: false } : { text: fallbackAnswerOf(messages), fellBack: true };
}

async function runCase(evalCase: AssistantEvalCase): Promise<CaseRun> {
  const metrics = newMetrics();
  const startedAt = Date.now();
  const configureFormOpen = evalCase.context?.configureFormOpen === true;
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildAssistantSystemPrompt({
        supportUrl: config.ASSISTANT_SUPPORT_URL,
        isTrialing: evalCase.context?.isTrialing ?? false,
        page: evalCase.context?.page,
        dseq: evalCase.context?.dseq,
        configureFormOpen,
        recentActions: evalCase.context?.recentActions
      })
    },
    ...(evalCase.history ?? []),
    { role: "user", content: evalCase.question }
  ];
  const toolCalls: AssistantEvalToolCall[] = [];
  const answer: string[] = [];
  const proposalResults = new Map(Object.entries(evalCase.proposalResults ?? {}).map(([name, results]) => [name, [...results]]));
  let fellBack = false;

  for (let round = 0; ; round++) {
    const isFinalRound = round >= MAX_TOOL_ROUNDS;
    const completion = await complete(requestMessagesFor(messages, round), { isFinalRound, configureFormOpen }, metrics, startedAt);
    if (completion.content) answer.push(completion.content);
    if (isFinalRound || completion.toolCalls.length === 0) {
      if (!completion.content?.trim()) {
        const recovered = await answerNow(messages, configureFormOpen, metrics, startedAt);
        answer.push(recovered.text);
        fellBack = recovered.fellBack;
      }
      break;
    }

    messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      const earlierResult = earlierResultOf(call, messages);
      toolCalls.push({ name: call.function.name, arguments: argumentsOf(call), round, ...(earlierResult !== undefined && { repeated: true }) });
      metrics.toolCalls.push(call.function.name);
      messages.push(
        earlierResult !== undefined
          ? { role: "tool", tool_call_id: call.id, content: alreadyReadContentOf(call.function.name, earlierResult) }
          : toolMessageOf(evalCase, call, proposalResults)
      );
    }
  }

  metrics.totalMs = Date.now() - startedAt;
  metrics.answer = answer.join("\n\n");
  metrics.emptyAnswer = fellBack;

  return { ...scoreAssistantEval(evalCase.id, evalCase.expect, { toolCalls, answer: metrics.answer, fellBack }), ...metrics };
}

async function main() {
  if (!akashMlClient.isAvailable()) {
    process.stdout.write("AKASHML_API_KEY is not set, so there is nothing to evaluate.\n");
    return;
  }

  const caseIds = process.argv.slice(2);
  const unknownIds = caseIds.filter(caseId => !ASSISTANT_EVAL_CASES.some(({ id }) => id === caseId));
  if (unknownIds.length > 0) {
    process.stderr.write(`No eval case named ${unknownIds.join(", ")}.\n`);
    process.exitCode = 1;
    return;
  }

  const cases = caseIds.length > 0 ? ASSISTANT_EVAL_CASES.filter(({ id }) => caseIds.includes(id)) : ASSISTANT_EVAL_CASES;
  const results: CaseRun[] = [];
  for (const evalCase of cases) {
    const result = await runCase(evalCase).catch(error => ({
      id: evalCase.id,
      passed: false,
      failures: [`run failed: ${error instanceof Error ? error.message : String(error)}`]
    }));
    results.push(result);
    process.stdout.write(`${result.id} ${result.passed ? "PASS" : "FAIL"}\n`);
  }

  if (outFile)
    writeFileSync(
      outFile,
      JSON.stringify({ model: config.ASSISTANT_MODEL, reasoningEffort: config.ASSISTANT_REASONING_EFFORT, maxCompletionTokens, results }, null, 2)
    );
  process.stdout.write(`${formatAssistantEvalTable(results)}\n`);
  process.exitCode = results.every(({ passed }) => passed) ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
