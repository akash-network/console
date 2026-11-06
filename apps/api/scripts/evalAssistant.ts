import "reflect-metadata";
import "@akashnetwork/env-loader";

import { container } from "tsyringe";

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
import { assistantChatTools, isLiveHelpToolName, proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { earlierResultOf } from "@src/feedback/lib/assistant-turn-tool-calls/assistant-turn-tool-calls";
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
  const fixture = evalCase.toolResults?.[name] ?? (name === "search_docs" ? assistantKnowledge.search(String(argumentsOf(call).query ?? "")) : undefined);
  const payload =
    proposalActionTypeOf(name) || isLiveHelpToolName(name)
      ? { data: proposalResults.get(name)?.shift() ?? SHOWN_CARD }
      : fixture !== undefined
        ? { data: fixture }
        : { error: "No data for this tool in this case." };

  return { role: "tool", tool_call_id: call.id, content: toolContentOf(name, payload) };
}

async function complete(messages: ChatMessage[], isFinalRound: boolean) {
  return await akashMlClient.createChatCompletion(
    {
      model: config.ASSISTANT_MODEL,
      messages,
      tools: assistantChatTools(),
      tool_choice: isFinalRound ? "none" : "auto",
      max_completion_tokens: MAX_COMPLETION_TOKENS
    },
    { timeoutMs: COMPLETION_TIMEOUT_MS }
  );
}

async function answerNow(messages: ChatMessage[]): Promise<{ text: string; fellBack: boolean }> {
  const { content } = await complete([...messages, ANSWER_NOW_NOTE], true);
  return content?.trim() ? { text: content, fellBack: false } : { text: fallbackAnswerOf(messages), fellBack: true };
}

async function runCase(evalCase: AssistantEvalCase): Promise<AssistantEvalResult> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildAssistantSystemPrompt({
        supportUrl: config.ASSISTANT_SUPPORT_URL,
        isTrialing: evalCase.context?.isTrialing ?? false,
        page: evalCase.context?.page,
        dseq: evalCase.context?.dseq,
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
    const completion = await complete(requestMessagesFor(messages, round), isFinalRound);
    if (completion.content) answer.push(completion.content);
    if (isFinalRound || completion.toolCalls.length === 0) {
      if (!completion.content?.trim()) {
        const recovered = await answerNow(messages);
        answer.push(recovered.text);
        fellBack = recovered.fellBack;
      }
      break;
    }

    messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      const earlierResult = earlierResultOf(call, messages);
      toolCalls.push({ name: call.function.name, arguments: argumentsOf(call), ...(earlierResult !== undefined && { repeated: true }) });
      messages.push(
        earlierResult !== undefined
          ? { role: "tool", tool_call_id: call.id, content: alreadyReadContentOf(call.function.name, earlierResult) }
          : toolMessageOf(evalCase, call, proposalResults)
      );
    }
  }

  return scoreAssistantEval(evalCase.id, evalCase.expect, { toolCalls, answer: answer.join("\n\n"), fellBack });
}

async function main() {
  if (!akashMlClient.isAvailable()) {
    process.stdout.write("AKASHML_API_KEY is not set, so there is nothing to evaluate.\n");
    return;
  }

  const caseIds = process.argv.slice(2);
  const cases = caseIds.length > 0 ? ASSISTANT_EVAL_CASES.filter(({ id }) => caseIds.includes(id)) : ASSISTANT_EVAL_CASES;
  const results: AssistantEvalResult[] = [];
  for (const evalCase of cases) {
    results.push(
      await runCase(evalCase).catch(error => ({
        id: evalCase.id,
        passed: false,
        failures: [`run failed: ${error instanceof Error ? error.message : String(error)}`]
      }))
    );
  }

  process.stdout.write(`${formatAssistantEvalTable(results)}\n`);
  process.exitCode = results.every(({ passed }) => passed) ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
