import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useEndAssistantConversationMutation, useStartAssistantConversationMutation } from "@src/queries/useAssistantQueries";
import type { AssistantContext, AssistantStreamErrorCode, AssistantStreamEvent } from "@src/types/assistant";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { runAssistantTurn } from "../runAssistantTurn/runAssistantTurn";
import type { AssistantTranscriptMessage } from "../transcriptModel/transcriptModel";
import { applyTurnEvent, createTranscriptMessage, historyOf } from "../transcriptModel/transcriptModel";
import { useAssistantClientTools } from "../useAssistantClientTools/useAssistantClientTools";

export const DEPENDENCIES = { useServices, useAssistantClientTools, useStartAssistantConversationMutation, useEndAssistantConversationMutation };

export type AssistantProblem = "consent" | "unavailable" | "rate_limited" | "daily_limit" | "error";

type StartedConversation = { id: string; stored: boolean };

export type AssistantConversationEnd = "resolved" | "unresolved";

const CONSENT_ERROR_CODES = ["assistant_consent_required", "assistant_consent_outdated"];
const CONVERSATION_ENDED_ERROR_CODE = "assistant_conversation_ended";
const HTTP_SERVICE_UNAVAILABLE = 503;

export function problemOfError(error: unknown): AssistantProblem {
  const code = extractApiErrorCode(error);
  if (code && CONSENT_ERROR_CODES.includes(code)) return "consent";
  if (code === "assistant_rate_limited") return "rate_limited";
  if (code === "assistant_daily_limit") return "daily_limit";
  if (code === "assistant_unavailable" || (isApiError(error) && error.status === HTTP_SERVICE_UNAVAILABLE)) return "unavailable";
  return "error";
}

export function problemOfStreamError(code: AssistantStreamErrorCode): AssistantProblem {
  return code === "assistant_unavailable" ? "unavailable" : "error";
}

/** Lives in the panel host rather than the panel, so closing the panel keeps the conversation for when it opens again. */
export function useAssistantConversation({ context }: { context: AssistantContext }, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { assistantConversation } = d.useServices();
  const runClientTool = d.useAssistantClientTools();
  const { mutateAsync: startConversation } = d.useStartAssistantConversationMutation();
  const { mutateAsync: endConversation } = d.useEndAssistantConversationMutation();
  const [messages, setMessages] = useState<AssistantTranscriptMessage[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [problem, setProblem] = useState<AssistantProblem | null>(null);
  const [conversation, setConversation] = useState<StartedConversation | null>(null);
  const [endedAs, setEndedAs] = useState<AssistantConversationEnd | null>(null);
  const conversationRef = useRef<StartedConversation | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(0);

  useEffect(function stopAnsweringOnUnmount() {
    return () => abortControllerRef.current?.abort();
  }, []);

  const nextMessageId = () => `message-${++messageCountRef.current}`;

  const ensureConversation = async (): Promise<StartedConversation> => {
    if (conversationRef.current) return conversationRef.current;

    const { data } = await startConversation({ data: { copyVersion: ASSISTANT_CONSENT_COPY_VERSION, context } });
    conversationRef.current = data;
    setConversation(data);
    return data;
  };

  const forgetConversation = () => {
    conversationRef.current = null;
    setConversation(null);
  };

  const streamAnswer = async (input: {
    content: string;
    questionId: string;
    answerId: string;
    history: ReturnType<typeof historyOf>;
    signal: AbortSignal;
    canRestart: boolean;
  }) => {
    const current = await ensureConversation();
    const applyToTurn = (event: AssistantStreamEvent) => setMessages(previous => applyTurnEvent(previous, input, event));

    try {
      const end = await runAssistantTurn({
        events: assistantConversation.sendMessage(
          current.id,
          { data: { content: input.content, history: current.stored ? undefined : input.history, context } },
          input.signal
        ),
        resume: results => assistantConversation.submitClientToolResults(current.id, { data: { results } }, input.signal),
        runClientTool,
        onEvent: applyToTurn
      });
      if (end.kind === "error") setProblem(problemOfStreamError(end.code));
    } catch (error) {
      if (!input.canRestart || extractApiErrorCode(error) !== CONVERSATION_ENDED_ERROR_CODE) throw error;

      forgetConversation();
      await streamAnswer({ ...input, canRestart: false });
    }
  };

  const send = async (content: string) => {
    const question = content.trim();
    if (!question || isAnswering) return;

    const history = historyOf(messagesRef.current);
    const asked = createTranscriptMessage(nextMessageId(), "user", question);
    const answer = createTranscriptMessage(nextMessageId(), "assistant");
    setMessages(previous => [...previous, asked, answer]);
    setProblem(null);
    setEndedAs(null);
    setIsAnswering(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await streamAnswer({ content: question, questionId: asked.id, answerId: answer.id, history, signal: abortController.signal, canRestart: true });
    } catch (error) {
      if (!abortController.signal.aborted) setProblem(problemOfError(error));
    } finally {
      setIsAnswering(false);
    }
  };

  const end = async (resolvedByUser: boolean) => {
    setEndedAs(resolvedByUser ? "resolved" : "unresolved");
    const current = conversationRef.current;
    if (!current) return;

    forgetConversation();
    await endConversation({ id: current.id, data: { resolvedByUser } }).catch(() => undefined);
  };

  const startOver = () => {
    abortControllerRef.current?.abort();
    forgetConversation();
    setMessages([]);
    setProblem(null);
    setEndedAs(null);
  };

  const clearProblem = useCallback(() => setProblem(null), []);

  return {
    messages,
    isAnswering,
    problem,
    endedAs,
    conversationId: conversation?.id ?? null,
    isStored: !!conversation?.stored,
    page: context.page ?? null,
    deploymentDseq: context.dseq ?? null,
    send,
    end,
    startOver,
    clearProblem
  };
}

export type AssistantConversation = ReturnType<typeof useAssistantConversation>;
