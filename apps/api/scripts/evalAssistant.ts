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
import { assistantKnowledge } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { buildAssistantSystemPrompt } from "@src/feedback/lib/assistant-system-prompt/assistant-system-prompt";
import { assistantChatTools, isLiveHelpToolName, proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { AkashMlClient, type ChatMessage, type ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { toolContentOf } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";

const MAX_ROUNDS = 6;
const MAX_COMPLETION_TOKENS = 1200;
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

function toolMessageOf(evalCase: AssistantEvalCase, call: ChatToolCall): ChatMessage {
  const name = call.function.name;
  const fixture = evalCase.toolResults?.[name] ?? (name === "search_docs" ? assistantKnowledge.search(String(argumentsOf(call).query ?? "")) : undefined);
  const payload =
    proposalActionTypeOf(name) || isLiveHelpToolName(name)
      ? { data: { shown: true, note: "The user sees a card and decides; nothing ran yet." } }
      : fixture !== undefined
        ? { data: fixture }
        : { error: "No data for this tool in this case." };

  return { role: "tool", tool_call_id: call.id, content: toolContentOf(name, payload) };
}

async function runCase(evalCase: AssistantEvalCase): Promise<AssistantEvalResult> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildAssistantSystemPrompt({
        supportUrl: config.ASSISTANT_SUPPORT_URL,
        isTrialing: evalCase.context?.isTrialing ?? false,
        page: evalCase.context?.page,
        dseq: evalCase.context?.dseq
      })
    },
    { role: "user", content: evalCase.question }
  ];
  const toolCalls: AssistantEvalToolCall[] = [];
  const answer: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const completion = await akashMlClient.createChatCompletion(
      {
        model: config.ASSISTANT_MODEL,
        messages,
        tools: assistantChatTools(),
        tool_choice: round === MAX_ROUNDS - 1 ? "none" : "auto",
        max_completion_tokens: MAX_COMPLETION_TOKENS
      },
      { timeoutMs: COMPLETION_TIMEOUT_MS }
    );
    if (completion.content) answer.push(completion.content);
    if (completion.toolCalls.length === 0) break;

    messages.push({ role: "assistant", content: completion.content, tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      toolCalls.push({ name: call.function.name, arguments: argumentsOf(call) });
      messages.push(toolMessageOf(evalCase, call));
    }
  }

  return scoreAssistantEval(evalCase.id, evalCase.expect, { toolCalls, answer: answer.join("\n\n") });
}

async function main() {
  if (!akashMlClient.isAvailable()) {
    process.stdout.write("AKASHML_API_KEY is not set, so there is nothing to evaluate.\n");
    return;
  }

  const results: AssistantEvalResult[] = [];
  for (const evalCase of ASSISTANT_EVAL_CASES) {
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
