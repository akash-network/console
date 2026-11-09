import createError from "http-errors";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type {
  EndAssistantConversationRequest,
  EndAssistantConversationResponse,
  RecordAssistantActionResultRequest,
  SendAssistantMessageRequest,
  StartAssistantConversationRequest,
  StartAssistantConversationResponse,
  SubmitClientToolResultsRequest
} from "@src/feedback/http-schemas/assistant-conversation.schema";
import { ASSISTANT_ERROR_CODES, assistantUnavailable } from "@src/feedback/lib/assistant-errors/assistant-errors";
import { ACTION_RESULT_TOOL_NAME, historyFromClient, historyFromStored, recentActionsOf } from "@src/feedback/lib/assistant-history/assistant-history";
import { buildAssistantSystemPrompt } from "@src/feedback/lib/assistant-system-prompt/assistant-system-prompt";
import { countRedactions, redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { AssistantConversationContext } from "@src/feedback/model-schemas";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { type AssistantConsentOutput, AssistantConsentRepository } from "@src/feedback/repositories/assistant-consent/assistant-consent.repository";
import {
  type AssistantConversationOutput,
  AssistantConversationRepository
} from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantConversationDailyCountRepository } from "@src/feedback/repositories/assistant-conversation-daily-count/assistant-conversation-daily-count.repository";
import { AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import { AssistantPendingTurnRepository } from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import { AkashMlClient, type ChatMessage } from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantLimitsService } from "@src/feedback/services/assistant-limits/assistant-limits.service";
import { toolContentOf, truncated } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import { AssistantTranscriptService } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";
import { AssistantTurnService, type EmitAssistantEvent } from "@src/feedback/services/assistant-turn/assistant-turn.service";
import { ClassifyConversation, classifyConversationOptionsFor } from "@src/feedback/services/classify-conversation/classify-conversation.handler";

/** Logs matter most at their end, so a long excerpt keeps its last lines. */
const MAX_CLIENT_EXCERPT_LENGTH = 6_000;

export type RunAssistantTurn = (emit: EmitAssistantEvent, signal: AbortSignal) => Promise<void>;

type ConversationContextInput = StartAssistantConversationRequest["data"]["context"];

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const CLIENT_READ_SUBJECTS: Record<string, string> = { read_logs: "logs", read_events: "events", read_configure_form: "the configure form" };

/** Logs and events matter most at their end, while a form read is one JSON document that only reads whole from its start. */
function excerptOf(tool: string, content: string): string {
  if (content.length <= MAX_CLIENT_EXCERPT_LENGTH) return content;

  return tool === "read_configure_form"
    ? truncated(content, MAX_CLIENT_EXCERPT_LENGTH)
    : `...[earlier lines dropped]${content.slice(-MAX_CLIENT_EXCERPT_LENGTH)}`;
}

/** Stores a conversation only when the user allowed review; otherwise the client holds the history and the API keeps a daily count when it ends. */
@singleton()
export class AssistantConversationService {
  constructor(
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly assistantConsentRepository: AssistantConsentRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly assistantMessageRepository: AssistantMessageRepository,
    private readonly assistantConversationDailyCountRepository: AssistantConversationDailyCountRepository,
    private readonly assistantPendingTurnRepository: AssistantPendingTurnRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly akashMlClient: AkashMlClient,
    private readonly limitsService: AssistantLimitsService,
    private readonly transcriptService: AssistantTranscriptService,
    private readonly turnService: AssistantTurnService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig
  ) {}

  async start({ copyVersion, context }: StartAssistantConversationRequest["data"]): Promise<StartAssistantConversationResponse["data"]> {
    const consent = await this.#currentConsent();
    if (consent.copyVersion !== copyVersion) {
      throw createError(409, "The consent changed since it was given. Ask the user to agree again.", { errorCode: ASSISTANT_ERROR_CODES.consentOutdated });
    }

    if (!consent.reviewOptIn) return { id: randomUUID(), stored: false };

    const conversation = await this.assistantConversationRepository.accessibleBy(this.authService.ability, "create").create({
      userId: this.authService.currentUser.id,
      organizationId: this.#currentOrganizationId(),
      context: { page: context?.page, dseq: context?.dseq, isTrialing: await this.#isTrialing() }
    });

    return { id: conversation.id, stored: true };
  }

  async prepareMessage(conversationId: string, { content, history, context }: SendAssistantMessageRequest["data"]): Promise<RunAssistantTurn> {
    const { consent, isTrialing } = await this.#admit({ countsAsMessage: true });
    const conversation = await this.#ownConversation(conversationId);
    if (conversation?.endedAt) throw createError(409, "This conversation has ended. Start a new one.", { errorCode: ASSISTANT_ERROR_CODES.conversationEnded });

    const stored = !!conversation && consent.reviewOptIn;
    const userMessage = redactSecrets(content);
    const storedMessages = conversation ? await this.assistantMessageRepository.findAllOf(conversation.id) : [];
    const earlier = conversation ? historyFromStored(storedMessages) : historyFromClient(history);

    if (stored) await this.transcriptService.record(conversationId, { role: "user", content: userMessage });

    const configureFormOpen = context?.configureFormOpen === true;
    const messages: ChatMessage[] = [
      { role: "system", content: this.#systemPromptFor(context ?? conversation?.context, { isTrialing, configureFormOpen }, recentActionsOf(storedMessages)) },
      ...earlier,
      { role: "user", content: userMessage }
    ];

    const redactedSecretCount = countRedactions(content, userMessage);
    const organizationId = this.#currentOrganizationId();
    const page = context?.page ?? conversation?.context.page ?? null;

    return async (emit, signal) => {
      if (redactedSecretCount > 0) await emit({ type: "secret_redacted", count: redactedSecretCount });
      await this.turnService.run(
        { conversationId, userId: this.authService.currentUser.id, organizationId, page, stored, isTrialing, configureFormOpen, messages, roundsUsed: 0 },
        emit,
        signal
      );
    };
  }

  /** Each requested call must be answered once, so a resumed turn never shows the model a result it did not ask for. */
  async prepareClientToolResults(conversationId: string, { results }: SubmitClientToolResultsRequest["data"]): Promise<RunAssistantTurn> {
    const { consent } = await this.#admit({ countsAsMessage: false });
    const userId = this.authService.currentUser.id;

    const turn = await this.txService.transaction(async () => {
      const pending = await this.assistantPendingTurnRepository.take(conversationId, userId, new Date());
      if (!pending) {
        throw createError(409, "The assistant is not waiting on the browser for this conversation.", { errorCode: ASSISTANT_ERROR_CODES.noPendingToolRequest });
      }

      const requestedIds = pending.state.clientToolCalls.map(({ id }) => id).sort();
      const answeredIds = results.map(({ toolCallId }) => toolCallId).sort();
      if (requestedIds.join("\n") !== answeredIds.join("\n")) {
        throw createError(400, "Answer each requested tool call exactly once.", { errorCode: ASSISTANT_ERROR_CODES.toolResultsMismatch });
      }

      return pending;
    });

    const { state } = turn;
    const stored = state.stored && consent.reviewOptIn;
    const toolMessages: ChatMessage[] = state.clientToolCalls.map(call => {
      const result = results.find(({ toolCallId }) => toolCallId === call.id)!;
      const excerpt = redactSecrets(excerptOf(call.function.name, result.content));
      const payload = result.ok ? { data: { untrustedExcerpt: excerpt } } : { error: truncated(excerpt, MAX_CLIENT_EXCERPT_LENGTH) };

      return { role: "tool", tool_call_id: call.id, content: toolContentOf(call.function.name, payload) };
    });

    if (stored) {
      for (const call of state.clientToolCalls) {
        const ok = results.find(({ toolCallId }) => toolCallId === call.id)!.ok;
        await this.transcriptService.record(conversationId, {
          role: "tool",
          content: `${ok ? "Read" : "Could not read"} ${CLIENT_READ_SUBJECTS[call.function.name] ?? "events"} in the browser`,
          toolName: call.function.name,
          toolPayload: { toolCallId: call.id, ok }
        });
      }
    }

    return (emit, signal) =>
      this.turnService.run(
        {
          conversationId,
          userId,
          organizationId: state.organizationId ?? null,
          page: state.page ?? null,
          stored,
          isTrialing: state.isTrialing,
          configureFormOpen: state.configureFormOpen === true,
          messages: [...state.messages, ...toolMessages],
          roundsUsed: state.roundsUsed
        },
        emit,
        signal
      );
  }

  /** Ends a stored conversation once, so the daily count and the classification job never double. */
  async end(conversationId: string, { resolvedByUser }: EndAssistantConversationRequest["data"]): Promise<EndAssistantConversationResponse["data"]> {
    const status = resolvedByUser === true ? "resolved" : "unresolved";
    const conversation = await this.#ownConversation(conversationId);
    await this.assistantPendingTurnRepository.release(conversationId, this.authService.currentUser.id);

    if (!conversation) {
      await this.assistantConversationDailyCountRepository.countEnded(dayOf(new Date()), status === "resolved");
      return { id: conversationId, status };
    }

    return await this.txService.transaction(async () => {
      const ended = await this.assistantConversationRepository.endOpen(conversation.id, {
        status,
        resolvedByUser: resolvedByUser ?? null,
        endedAt: new Date()
      });
      if (!ended) return { id: conversation.id, status: conversation.status === "resolved" ? "resolved" : "unresolved" };

      await this.assistantConversationDailyCountRepository.countEnded(dayOf(ended.endedAt!), status === "resolved");
      await this.jobQueueService.enqueue(new ClassifyConversation({ conversationId: ended.id }), classifyConversationOptionsFor(ended.id));

      return { id: ended.id, status };
    });
  }

  async recordActionResult(conversationId: string, input: RecordAssistantActionResultRequest["data"]): Promise<{ recorded: boolean }> {
    const conversation = await this.#ownConversation(conversationId);
    if (!conversation || !(await this.#latestConsent())?.reviewOptIn) return { recorded: false };

    const proposal = await this.assistantMessageRepository.findProposal(conversation.id, input.proposalId);
    if (!proposal) throw createError(404, "No such proposal in this conversation.", { errorCode: ASSISTANT_ERROR_CODES.proposalNotFound });

    const error = input.error ? redactSecrets(input.error) : undefined;
    await this.transcriptService.record(conversation.id, {
      role: "tool",
      content: [input.actionType.replaceAll("_", " "), input.decision, input.outcome, error].filter(Boolean).join(", "),
      toolName: ACTION_RESULT_TOOL_NAME,
      toolPayload: {
        proposalId: input.proposalId,
        actionType: input.actionType,
        decision: input.decision,
        outcome: input.outcome ?? null,
        error: error ?? null
      }
    });

    return { recorded: true };
  }

  async #admit({ countsAsMessage }: { countsAsMessage: boolean }): Promise<{ consent: AssistantConsentOutput; isTrialing: boolean | null }> {
    const consent = await this.#currentConsent();
    if (!this.akashMlClient.isAvailable()) throw assistantUnavailable();

    const isTrialing = await this.#isTrialing();
    if (countsAsMessage) await this.limitsService.countMessage(this.authService.currentUser.id, isTrialing);
    await this.limitsService.assertWithinBudget();

    return { consent, isTrialing };
  }

  async #currentConsent(): Promise<AssistantConsentOutput> {
    const consent = await this.#latestConsent();
    if (!consent) {
      throw createError(409, "Agree to the assistant terms before starting a conversation.", { errorCode: ASSISTANT_ERROR_CODES.consentRequired });
    }

    return consent;
  }

  async #latestConsent(): Promise<AssistantConsentOutput | undefined> {
    return await this.assistantConsentRepository.accessibleBy(this.authService.ability, "read").findLatestByUserId(this.authService.currentUser.id);
  }

  async #ownConversation(conversationId: string): Promise<AssistantConversationOutput | undefined> {
    return await this.assistantConversationRepository
      .accessibleBy(this.authService.ability, "read")
      .findOneBy({ id: conversationId, userId: this.authService.currentUser.id });
  }

  #currentOrganizationId(): string | null {
    return this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId ?? null;
  }

  async #isTrialing(): Promise<boolean | null> {
    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").findOneUsedBy(this.authService.currentUser.id);
    return wallet?.isTrialing ?? null;
  }

  #systemPromptFor(
    context: ConversationContextInput | AssistantConversationContext | undefined,
    { isTrialing, configureFormOpen }: { isTrialing: boolean | null; configureFormOpen: boolean },
    recentActions: string[]
  ): string {
    return buildAssistantSystemPrompt({
      supportUrl: this.config.ASSISTANT_SUPPORT_URL,
      isTrialing,
      page: context?.page,
      dseq: context?.dseq,
      configureFormOpen,
      recentActions
    });
  }
}
