import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import {
  useCreateAssistantProblemReportMutation,
  useEndAssistantConversationMutation,
  useRateAssistantTurnMutation,
  useStartAssistantConversationMutation
} from "@src/queries/useAssistantQueries";
import type { AssistantContext, AssistantStreamErrorCode, AssistantStreamEvent, AssistantTurnRating } from "@src/types/assistant";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { ASSISTANT_REPORT_CONSENT_COPY_VERSION } from "../assistantReportConsentCopy";
import { runAssistantTurn } from "../runAssistantTurn/runAssistantTurn";
import type { AssistantTranscriptMessage } from "../transcriptModel/transcriptModel";
import { applyTurnEvent, canGiveFeedbackOn, createTranscriptMessage, historyOf, signedHistoryOf } from "../transcriptModel/transcriptModel";
import { useAssistantClientTools } from "../useAssistantClientTools/useAssistantClientTools";

export const DEPENDENCIES = {
  useServices,
  useAssistantClientTools,
  useStartAssistantConversationMutation,
  useEndAssistantConversationMutation,
  useRateAssistantTurnMutation,
  useCreateAssistantProblemReportMutation
};

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
  const { mutateAsync: rateTurn } = d.useRateAssistantTurnMutation();
  const { mutateAsync: createProblemReport } = d.useCreateAssistantProblemReportMutation();
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
  const ratingMessageIdsRef = useRef(new Set<string>());

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

  const updateMessage = (messageId: string, change: Partial<AssistantTranscriptMessage>) =>
    setMessages(previous => previous.map(message => (message.id === messageId ? { ...message, ...change } : message)));

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
    updateMessage(input.questionId, { conversationId: current.id });
    updateMessage(input.answerId, { conversationId: current.id });
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

  /** Shows the new rating at once and puts the old one back if the api refuses it, one request per answer at a time so a revert never undoes a later rating. */
  const rate = async (messageId: string, rating: AssistantTurnRating) => {
    const message = messagesRef.current.find(({ id }) => id === messageId);
    if (!message || !canGiveFeedbackOn(message) || ratingMessageIdsRef.current.has(messageId)) return;

    ratingMessageIdsRef.current.add(messageId);
    updateMessage(messageId, { rating, isRating: true });
    try {
      await rateTurn({ id: message.conversationId, turnId: message.turnId, data: { rating } });
      updateMessage(messageId, { isRating: false });
    } catch {
      updateMessage(messageId, { rating: message.rating, isRating: false });
    } finally {
      ratingMessageIdsRef.current.delete(messageId);
    }
  };

  /** The api verifies each answer's signature against the conversation it was given in, so only that conversation's messages go along. */
  const reportProblem = async (messageId: string, note: string) => {
    const message = messagesRef.current.find(({ id }) => id === messageId);
    if (!message || !canGiveFeedbackOn(message)) return;

    const conversationMessages = messagesRef.current.filter(({ conversationId }) => conversationId === message.conversationId);
    await createProblemReport({
      id: message.conversationId,
      data: {
        turnId: message.turnId,
        note: note.trim() || undefined,
        copyVersion: ASSISTANT_REPORT_CONSENT_COPY_VERSION,
        history: signedHistoryOf(conversationMessages)
      }
    });
    updateMessage(messageId, { reported: true });
  };

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
    clearProblem,
    rate,
    reportProblem
  };
}

export type AssistantConversation = ReturnType<typeof useAssistantConversation>;
