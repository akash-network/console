import type { MongoAbility } from "@casl/ability";
import createError from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { envSchema } from "@src/feedback/config/env.config";
import { ACTION_RESULT_TOOL_NAME } from "@src/feedback/lib/assistant-history/assistant-history";
import { ASSISTANT_PROMPT_VERSION } from "@src/feedback/lib/assistant-prompt-version/assistant-prompt-version";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { AssistantConsentOutput, AssistantConsentRepository } from "@src/feedback/repositories/assistant-consent/assistant-consent.repository";
import type {
  AssistantConversationOutput,
  AssistantConversationRepository
} from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { AssistantConversationDailyCountRepository } from "@src/feedback/repositories/assistant-conversation-daily-count/assistant-conversation-daily-count.repository";
import type { AssistantMessageOutput, AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import type {
  AssistantPendingTurnOutput,
  AssistantPendingTurnRepository
} from "@src/feedback/repositories/assistant-pending-turn/assistant-pending-turn.repository";
import type { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { AkashMlClient, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import type { AssistantLimitsService } from "@src/feedback/services/assistant-limits/assistant-limits.service";
import { toolContentOf } from "@src/feedback/services/assistant-tool-runner/assistant-tool-runner.service";
import type { AssistantTranscriptService } from "@src/feedback/services/assistant-transcript/assistant-transcript.service";
import type { AssistantTurnService } from "@src/feedback/services/assistant-turn/assistant-turn.service";
import { ClassifyConversation, classifyConversationOptionsFor } from "@src/feedback/services/classify-conversation/classify-conversation.handler";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { AssistantConversationService } from "./assistant-conversation.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const NOW = new Date("2026-11-04T23:30:00.000Z");
const CONVERSATION_ID = "0b6e7c9a-6a4e-4d3f-9a1e-6f2d1c3b4a5e";
const FAKE_TOKEN = `ghp_${"Z9y8X7w6V5".repeat(3)}`;

function consent(overrides: Partial<AssistantConsentOutput> = {}): AssistantConsentOutput {
  return { id: "consent-1", userId: "user-1", copyVersion: "v1", processingAcceptedAt: NOW, reviewOptIn: true, createdAt: NOW, ...overrides };
}

function conversation(overrides: Partial<AssistantConversationOutput> = {}): AssistantConversationOutput {
  return mock<AssistantConversationOutput>({
    id: CONVERSATION_ID,
    userId: "user-1",
    status: "open",
    endedAt: null,
    context: { isTrialing: false },
    ...overrides
  });
}

function message(overrides: Partial<AssistantMessageOutput>): AssistantMessageOutput {
  return { id: "m", conversationId: CONVERSATION_ID, role: "user", content: "", toolName: null, toolPayload: null, createdAt: NOW, ...overrides };
}

function toolCall(id: string, name: string): ChatToolCall {
  return { id, type: "function", function: { name, arguments: '{"dseq":"42"}' } };
}

describe(AssistantConversationService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("start", () => {
    it("refuses a user who never agreed", async () => {
      const { service, consentRepository } = setup();
      consentRepository.findLatestByUserId.mockResolvedValue(undefined);

      await expect(service.start({ copyVersion: "v1" })).rejects.toMatchObject({ status: 409, errorCode: "assistant_consent_required" });
    });

    it("refuses a copy version the user did not agree to", async () => {
      const { service } = setup();

      await expect(service.start({ copyVersion: "v2" })).rejects.toMatchObject({ status: 409, errorCode: "assistant_consent_outdated" });
    });

    it("stores nothing without the review opt-in", async () => {
      const { service, conversationRepository } = setup({ consent: consent({ reviewOptIn: false }) });

      const result = await service.start({ copyVersion: "v1", context: { page: "/deployments" } });

      expect(result).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), stored: false });
      expect(conversationRepository.create).not.toHaveBeenCalled();
    });

    it("stores the conversation with its context, organization and trial status when the user allowed review", async () => {
      const { service, conversationRepository, consentRepository, authService } = setup({
        organizationId: "org-1",
        wallet: createUserWallet({ isTrialing: true })
      });
      conversationRepository.create.mockResolvedValue(conversation());

      const result = await service.start({ copyVersion: "v1", context: { page: "/deployments/42", dseq: "42" } });

      expect(consentRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(conversationRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
      expect(conversationRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        organizationId: "org-1",
        context: { page: "/deployments/42", dseq: "42", isTrialing: true }
      });
      expect(result).toEqual({ id: CONVERSATION_ID, stored: true });
    });

    it("keeps whether the configure form is open out of the stored context", async () => {
      const { service, conversationRepository } = setup({ wallet: createUserWallet({ isTrialing: false }) });
      conversationRepository.create.mockResolvedValue(conversation());

      await service.start({ copyVersion: "v1", context: { page: "/new-deployment/configure", configureFormOpen: true } });

      expect(conversationRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        organizationId: null,
        context: { page: "/new-deployment/configure", dseq: undefined, isTrialing: false }
      });
    });

    it("files a conversation outside an organization with no organization and an unknown trial status", async () => {
      const { service, conversationRepository } = setup({ wallet: undefined });
      conversationRepository.create.mockResolvedValue(conversation());

      await service.start({ copyVersion: "v1" });

      expect(conversationRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        organizationId: null,
        context: { page: undefined, dseq: undefined, isTrialing: null }
      });
    });
  });

  describe("prepareMessage", () => {
    it("refuses before counting when the assistant is unavailable", async () => {
      const { service, akashMlClient, limitsService } = setup();
      akashMlClient.isAvailable.mockReturnValue(false);

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ status: 503, errorCode: "assistant_unavailable" });
      expect(limitsService.countMessage).not.toHaveBeenCalled();
    });

    it("refuses a user who withdrew consent", async () => {
      const { service, consentRepository } = setup();
      consentRepository.findLatestByUserId.mockResolvedValue(undefined);

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ errorCode: "assistant_consent_required" });
    });

    it("refuses a message to an ended conversation", async () => {
      const { service, conversationRepository } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation({ endedAt: NOW }));

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({
        status: 409,
        errorCode: "assistant_conversation_ended"
      });
    });

    it("lets a limit refusal through", async () => {
      const { service, limitsService } = setup();
      limitsService.countMessage.mockRejectedValue(Object.assign(new Error("slow down"), { status: 429 }));

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toThrow("slow down");
    });

    it("traces a message refused by the rate limit as limited and still refuses it", async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, limitsService, traceRepository, config } = setup({ organizationId: "org-1" });
      const refusal = createError(429, "slow down", { errorCode: "assistant_rate_limited" });
      limitsService.countMessage.mockRejectedValue(refusal);

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi", context: { page: "/deployments/42" } })).rejects.toBe(refusal);

      expect(traceRepository.create).toHaveBeenCalledTimes(1);
      expect(traceRepository.create).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        userId: "user-1",
        organizationId: "org-1",
        page: "/deployments/42",
        model: config.ASSISTANT_MODEL,
        promptVersion: ASSISTANT_PROMPT_VERSION,
        outcome: "limited",
        startedAt: NOW,
        firstTokenMs: null,
        durationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        toolCalls: [],
        cards: []
      });
    });

    it("traces a message refused by the daily limit outside an organization and any page with both as null", async () => {
      const { service, limitsService, traceRepository } = setup();
      const refusal = createError(429, "come back tomorrow", { errorCode: "assistant_daily_limit" });
      limitsService.countMessage.mockRejectedValue(refusal);

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toBe(refusal);

      expect(traceRepository.create).toHaveBeenCalledWith(expect.objectContaining({ outcome: "limited", organizationId: null, page: null }));
    });

    it("writes no trace for a refusal that is not a limit", async () => {
      const { service, limitsService, consentRepository, akashMlClient, traceRepository } = setup();
      limitsService.countMessage.mockRejectedValueOnce(createError(500, "db down"));
      limitsService.assertWithinBudget.mockRejectedValueOnce(createError(503, "over budget"));

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ status: 500 });
      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ status: 503 });
      akashMlClient.isAvailable.mockReturnValueOnce(false);
      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ status: 503 });
      consentRepository.findLatestByUserId.mockResolvedValueOnce(undefined);
      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toMatchObject({ status: 409 });

      expect(traceRepository.create).not.toHaveBeenCalled();
    });

    it("still refuses a limited message and logs ASSISTANT_TURN_TRACE_FAILED when its trace cannot be written", async () => {
      const { service, limitsService, traceRepository, logger } = setup();
      const refusal = createError(429, "slow down", { errorCode: "assistant_rate_limited" });
      const error = new Error("db down");
      limitsService.countMessage.mockRejectedValue(refusal);
      traceRepository.create.mockRejectedValue(error);

      await expect(service.prepareMessage(CONVERSATION_ID, { content: "hi" })).rejects.toBe(refusal);

      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    });

    it("stores the redacted message of a stored conversation and replays its stored history", async () => {
      const { service, conversationRepository, messageRepository, transcriptService, limitsService, turnService, authService } = setup({
        wallet: createUserWallet({ isTrialing: true })
      });
      conversationRepository.findOneBy.mockResolvedValue(conversation({ context: { page: "/deployments/42", dseq: "42", isTrialing: true } }));
      messageRepository.findAllOf.mockResolvedValue([message({ role: "user", content: "earlier" }), message({ role: "assistant", content: "answer" })]);

      const run = await service.prepareMessage(CONVERSATION_ID, { content: `my token is ${FAKE_TOKEN}`, history: [{ role: "user", content: "ignored" }] });
      const emit = vi.fn();
      const signal = new AbortController().signal;
      await run(emit, signal);

      expect(conversationRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(conversationRepository.findOneBy).toHaveBeenCalledWith({ id: CONVERSATION_ID, userId: "user-1" });
      expect(limitsService.countMessage).toHaveBeenCalledWith("user-1", true);
      expect(limitsService.assertWithinBudget).toHaveBeenCalled();
      expect(messageRepository.findAllOf).toHaveBeenCalledWith(CONVERSATION_ID);
      expect(transcriptService.record).toHaveBeenCalledWith(CONVERSATION_ID, { role: "user", content: `my token is ${REDACTED}` });
      const [turn, passedEmit, passedSignal] = turnService.run.mock.calls[0];
      expect(passedEmit).toBe(emit);
      expect(passedSignal).toBe(signal);
      expect(turn).toMatchObject({
        conversationId: CONVERSATION_ID,
        userId: "user-1",
        stored: true,
        isTrialing: true,
        configureFormOpen: false,
        roundsUsed: 0
      });
      expect(turn.messages.slice(1)).toEqual([
        { role: "user", content: "earlier" },
        { role: "assistant", content: "answer" },
        { role: "user", content: `my token is ${REDACTED}` }
      ]);
      expect(turn.messages[0].role).toBe("system");
      expect(turn.messages[0].content).toContain('deployment "42"');
      expect(turn.messages[0].content).toContain("https://discord.example");
      expect(turn.messages[0].content).toContain("free trial");
    });

    it("offers the configure form tools and rules while the browser has the form open", async () => {
      const { service, turnService } = setup();

      const run = await service.prepareMessage(CONVERSATION_ID, {
        content: "no providers",
        context: { page: "/new-deployment/configure", configureFormOpen: true }
      });
      await run(vi.fn(), new AbortController().signal);

      const [turn] = turnService.run.mock.calls[0];
      expect(turn.configureFormOpen).toBe(true);
      expect(turn.messages[0].content).toContain("call read_configure_form first");
    });

    it("tells the model what the user did with the latest cards of a stored conversation", async () => {
      const { service, conversationRepository, messageRepository, turnService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation({}));
      messageRepository.findAllOf.mockResolvedValue([
        message({
          role: "tool",
          toolName: "propose_create_deployment",
          toolPayload: { proposalId: "p1", action: { type: "create_deployment", name: "dart" } }
        }),
        message({
          role: "tool",
          toolName: ACTION_RESULT_TOOL_NAME,
          content: "create deployment, confirmed, succeeded",
          toolPayload: { proposalId: "p1", actionType: "create_deployment", decision: "confirmed", outcome: "succeeded", error: null }
        })
      ]);

      const run = await service.prepareMessage(CONVERSATION_ID, { content: "this template didn't work" });
      await run(vi.fn(), new AbortController().signal);

      const [turn] = turnService.run.mock.calls[0];
      expect(turn.messages[0].content).toContain('create deployment named "dart": confirmed, succeeded at 2026-11-04 23:30 UTC');
    });

    it("tells the browser how many secrets it removed before the turn, without the value or its kind", async () => {
      const { service, turnService } = setup();
      const emit = vi.fn(async () => undefined);
      turnService.run.mockImplementation(async () => {
        expect(emit).toHaveBeenCalledTimes(1);
      });

      const run = await service.prepareMessage(CONVERSATION_ID, { content: `token ${FAKE_TOKEN} and password=hunter22` });
      await run(emit, new AbortController().signal);

      expect(emit).toHaveBeenCalledWith({ type: "secret_redacted", count: 2 });
      expect(JSON.stringify(emit.mock.calls)).not.toContain(FAKE_TOKEN);
      expect(turnService.run).toHaveBeenCalled();
    });

    it("emits nothing extra for a message without secrets", async () => {
      const { service } = setup();
      const emit = vi.fn(async () => undefined);

      const run = await service.prepareMessage(CONVERSATION_ID, { content: "why no bids?" });
      await run(emit, new AbortController().signal);

      expect(emit).not.toHaveBeenCalled();
    });

    it("uses the client's history and stores nothing for a conversation the API does not hold", async () => {
      const { service, messageRepository, transcriptService, turnService } = setup();

      const run = await service.prepareMessage(CONVERSATION_ID, {
        content: "why no bids?",
        history: [{ role: "assistant", content: "Hello" }],
        context: { page: "/deployments/7", dseq: "7" }
      });
      await run(vi.fn(), new AbortController().signal);

      expect(messageRepository.findAllOf).not.toHaveBeenCalled();
      expect(transcriptService.record).not.toHaveBeenCalled();
      const [turn] = turnService.run.mock.calls[0];
      expect(turn).toMatchObject({ stored: false, isTrialing: false });
      expect(turn.messages.slice(1)).toEqual([
        { role: "assistant", content: "Hello" },
        { role: "user", content: "why no bids?" }
      ]);
      expect(turn.messages[0].content).toContain('deployment "7"');
    });

    it("stops storing a stored conversation once the user turned review off", async () => {
      const { service, conversationRepository, transcriptService, turnService } = setup({ consent: consent({ reviewOptIn: false }) });
      conversationRepository.findOneBy.mockResolvedValue(conversation());

      const run = await service.prepareMessage(CONVERSATION_ID, { content: "hi", context: { dseq: "9" } });
      await run(vi.fn(), new AbortController().signal);

      expect(transcriptService.record).not.toHaveBeenCalled();
      expect(turnService.run.mock.calls[0][0]).toMatchObject({ stored: false });
      expect(turnService.run.mock.calls[0][0].messages[0].content).toContain('deployment "9"');
    });
  });

  describe("prepareClientToolResults", () => {
    it("resumes the held turn with the redacted, bounded excerpts as untrusted tool results", async () => {
      const { service, pendingTurnRepository, transcriptService, turnService, limitsService, txService } = setup();
      const logs = toolCall("c1", "read_logs");
      const events = toolCall("c2", "read_events");
      pendingTurnRepository.take.mockResolvedValue(
        pendingTurn({ messages: [{ role: "user", content: "why crash?" }], clientToolCalls: [logs, events], roundsUsed: 2, stored: true, isTrialing: true })
      );
      const longLogs = `${"a".repeat(7000)}\npassword=hunter2`;

      const run = await service.prepareClientToolResults(CONVERSATION_ID, {
        results: [
          { toolCallId: "c2", content: "provider unreachable", ok: false },
          { toolCallId: "c1", content: longLogs, ok: true }
        ]
      });
      await run(vi.fn(), new AbortController().signal);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(pendingTurnRepository.take).toHaveBeenCalledWith(CONVERSATION_ID, "user-1", expect.any(Date));
      expect(limitsService.countMessage).not.toHaveBeenCalled();
      const [turn] = turnService.run.mock.calls[0];
      expect(turn).toMatchObject({ conversationId: CONVERSATION_ID, userId: "user-1", stored: true, isTrialing: true, roundsUsed: 2 });
      expect(turn.messages).toEqual([
        { role: "user", content: "why crash?" },
        {
          role: "tool",
          tool_call_id: "c1",
          content: toolContentOf("read_logs", { data: { untrustedExcerpt: `...[earlier lines dropped]${"a".repeat(5983)}\npassword=${REDACTED}` } })
        },
        { role: "tool", tool_call_id: "c2", content: toolContentOf("read_events", { error: "provider unreachable" }) }
      ]);
      expect(transcriptService.record.mock.calls).toEqual([
        [CONVERSATION_ID, { role: "tool", content: "Read logs in the browser", toolName: "read_logs", toolPayload: { toolCallId: "c1", ok: true } }],
        [
          CONVERSATION_ID,
          { role: "tool", content: "Could not read events in the browser", toolName: "read_events", toolPayload: { toolCallId: "c2", ok: false } }
        ]
      ]);
    });

    it("keeps the start of a long configure form read, labels it and resumes with the form still open", async () => {
      const { service, pendingTurnRepository, transcriptService, turnService } = setup();
      const form = toolCall("c1", "read_configure_form");
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [form], stored: true, configureFormOpen: true }));
      const longForm = `{"services":[${"x".repeat(7000)}]}`;

      const run = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: longForm, ok: true }] });
      await run(vi.fn(), new AbortController().signal);

      const [turn] = turnService.run.mock.calls[0];
      expect(turn.configureFormOpen).toBe(true);
      expect(turn.messages).toEqual([
        {
          role: "tool",
          tool_call_id: "c1",
          content: toolContentOf("read_configure_form", { data: { untrustedExcerpt: `{"services":[${"x".repeat(5973)}...[truncated]` } })
        }
      ]);
      expect(transcriptService.record).toHaveBeenCalledWith(CONVERSATION_ID, {
        role: "tool",
        content: "Read the configure form in the browser",
        toolName: "read_configure_form",
        toolPayload: { toolCallId: "c1", ok: true }
      });
    });

    it("resumes a turn held before the configure form tools existed with the form closed", async () => {
      const { service, pendingTurnRepository, turnService } = setup();
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [toolCall("c1", "read_events")] }));

      const run = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "OOMKilled", ok: true }] });
      await run(vi.fn(), new AbortController().signal);

      expect(turnService.run.mock.calls[0][0].configureFormOpen).toBe(false);
    });

    it("keeps a short excerpt whole and stores nothing for an unstored conversation", async () => {
      const { service, pendingTurnRepository, transcriptService, turnService } = setup();
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [toolCall("c1", "read_events")] }));

      const run = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "OOMKilled", ok: true }] });
      await run(vi.fn(), new AbortController().signal);

      expect(turnService.run.mock.calls[0][0].messages).toEqual([
        { role: "tool", tool_call_id: "c1", content: toolContentOf("read_events", { data: { untrustedExcerpt: "OOMKilled" } }) }
      ]);
      expect(transcriptService.record).not.toHaveBeenCalled();
    });

    it("stops storing a paused stored conversation once the user turned review off", async () => {
      const { service, pendingTurnRepository, transcriptService, turnService } = setup({ consent: consent({ reviewOptIn: false }) });
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [toolCall("c1", "read_logs")], stored: true }));

      const run = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "logs", ok: true }] });
      await run(vi.fn(), new AbortController().signal);

      expect(transcriptService.record).not.toHaveBeenCalled();
      expect(turnService.run.mock.calls[0][0]).toMatchObject({ stored: false });
    });

    it("passes the organization and page into the turn and keeps them for a resumed turn", async () => {
      const { service, executionContextService, pendingTurnRepository, turnService } = setup({ organizationId: "org-1" });
      pendingTurnRepository.take.mockResolvedValue(
        pendingTurn({ clientToolCalls: [toolCall("c1", "read_events")], organizationId: "org-1", page: "/deployments/42" })
      );

      const message = await service.prepareMessage(CONVERSATION_ID, { content: "why?", context: { page: "/deployments/42" } });
      await message(vi.fn(), new AbortController().signal);
      const resumed = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "OOMKilled", ok: true }] });
      await resumed(vi.fn(), new AbortController().signal);

      expect(turnService.run.mock.calls.map(([turn]) => ({ organizationId: turn.organizationId, page: turn.page }))).toEqual([
        { organizationId: "org-1", page: "/deployments/42" },
        { organizationId: "org-1", page: "/deployments/42" }
      ]);
      expect(executionContextService.get).toHaveBeenCalledWith("ORGANIZATION_CONTEXT");
    });

    it("traces a turn outside an organization and any page as null, and falls back to the page the conversation started on", async () => {
      const { service, conversationRepository, pendingTurnRepository, turnService } = setup();
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [toolCall("c1", "read_events")] }));

      const unheld = await service.prepareMessage(CONVERSATION_ID, { content: "why?" });
      await unheld(vi.fn(), new AbortController().signal);
      conversationRepository.findOneBy.mockResolvedValue(conversation({ context: { page: "/deployments/7", isTrialing: false } }));
      const stored = await service.prepareMessage(CONVERSATION_ID, { content: "why?" });
      await stored(vi.fn(), new AbortController().signal);
      const resumed = await service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "OOMKilled", ok: true }] });
      await resumed(vi.fn(), new AbortController().signal);

      expect(turnService.run.mock.calls.map(([turn]) => ({ organizationId: turn.organizationId, page: turn.page }))).toEqual([
        { organizationId: null, page: null },
        { organizationId: null, page: "/deployments/7" },
        { organizationId: null, page: null }
      ]);
    });

    it("refuses when no turn waits on the browser", async () => {
      const { service, pendingTurnRepository } = setup();
      pendingTurnRepository.take.mockResolvedValue(undefined);

      await expect(service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "x", ok: true }] })).rejects.toMatchObject({
        status: 409,
        errorCode: "assistant_no_pending_tool_request"
      });
    });

    it.each([[["c1"]], [["c1", "c2", "c3"]], [["c1", "c3"]]])("refuses results %j that do not answer each call once", async answered => {
      const { service, pendingTurnRepository } = setup();
      pendingTurnRepository.take.mockResolvedValue(pendingTurn({ clientToolCalls: [toolCall("c1", "read_logs"), toolCall("c2", "read_events")] }));

      await expect(
        service.prepareClientToolResults(CONVERSATION_ID, { results: answered.map(toolCallId => ({ toolCallId, content: "x", ok: true })) })
      ).rejects.toMatchObject({ status: 400, errorCode: "assistant_tool_results_mismatch" });
    });

    it("refuses when the assistant is unavailable", async () => {
      const { service, akashMlClient, pendingTurnRepository } = setup();
      akashMlClient.isAvailable.mockReturnValue(false);

      await expect(service.prepareClientToolResults(CONVERSATION_ID, { results: [{ toolCallId: "c1", content: "x", ok: true }] })).rejects.toMatchObject({
        errorCode: "assistant_unavailable"
      });
      expect(pendingTurnRepository.take).not.toHaveBeenCalled();
    });
  });

  describe("end", () => {
    it("counts an unstored conversation by its outcome and drops any paused turn", async () => {
      vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
      const { service, dailyCountRepository, pendingTurnRepository, jobQueueService } = setup();

      expect(await service.end(CONVERSATION_ID, { resolvedByUser: true })).toEqual({ id: CONVERSATION_ID, status: "resolved" });
      expect(await service.end(CONVERSATION_ID, {})).toEqual({ id: CONVERSATION_ID, status: "unresolved" });

      expect(dailyCountRepository.countEnded.mock.calls).toEqual([
        ["2026-11-04", true],
        ["2026-11-04", false]
      ]);
      expect(pendingTurnRepository.release).toHaveBeenCalledWith(CONVERSATION_ID, "user-1");
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("ends a stored conversation once, counts it and queues its classification in one transaction", async () => {
      vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
      const { service, conversationRepository, dailyCountRepository, jobQueueService, txService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      conversationRepository.endOpen.mockResolvedValue(conversation({ status: "unresolved", endedAt: NOW }));

      const result = await service.end(CONVERSATION_ID, { resolvedByUser: false });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(conversationRepository.endOpen).toHaveBeenCalledWith(CONVERSATION_ID, { status: "unresolved", resolvedByUser: false, endedAt: NOW });
      expect(dailyCountRepository.countEnded).toHaveBeenCalledWith("2026-11-04", false);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ClassifyConversation({ conversationId: CONVERSATION_ID }),
        classifyConversationOptionsFor(CONVERSATION_ID)
      );
      expect(result).toEqual({ id: CONVERSATION_ID, status: "unresolved" });
    });

    it("records an unknown outcome as unresolved with no answer from the user", async () => {
      const { service, conversationRepository } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      conversationRepository.endOpen.mockResolvedValue(conversation({ endedAt: NOW }));

      await service.end(CONVERSATION_ID, {});

      expect(conversationRepository.endOpen).toHaveBeenCalledWith(CONVERSATION_ID, { status: "unresolved", resolvedByUser: null, endedAt: expect.any(Date) });
    });

    it.each([
      ["resolved", "resolved"],
      ["unresolved", "unresolved"],
      ["open", "unresolved"]
    ] as const)("answers how an already ended %s conversation ended, without counting it again", async (status, expected) => {
      const { service, conversationRepository, dailyCountRepository, jobQueueService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation({ status, endedAt: NOW }));
      conversationRepository.endOpen.mockResolvedValue(undefined);

      expect(await service.end(CONVERSATION_ID, { resolvedByUser: true })).toEqual({ id: CONVERSATION_ID, status: expected });
      expect(dailyCountRepository.countEnded).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("recordActionResult", () => {
    const input = { proposalId: "6f1f4b62-0a8c-4b8e-9a54-0c6b1a7d5c11", actionType: "update_deployment", decision: "confirmed" as const };

    it("records nothing for an unstored conversation", async () => {
      const { service, transcriptService } = setup();

      expect(await service.recordActionResult(CONVERSATION_ID, input)).toEqual({ recorded: false });
      expect(transcriptService.record).not.toHaveBeenCalled();
    });

    it("records a card decision on the trace even when the conversation is not stored", async () => {
      const { service, consentRepository, traceRepository } = setup();
      consentRepository.findLatestByUserId.mockResolvedValue(consent({ reviewOptIn: false }));
      traceRepository.recordCardDecision.mockResolvedValue(true);

      expect(await service.recordActionResult(CONVERSATION_ID, { ...input, decision: "cancelled" })).toEqual({ recorded: false });
      expect(traceRepository.recordCardDecision).toHaveBeenCalledWith({
        userId: "user-1",
        conversationId: CONVERSATION_ID,
        proposalId: input.proposalId,
        decision: "cancelled"
      });
    });

    it("leaves recordActionResult's answer unchanged when no trace holds the proposal", async () => {
      const { service, conversationRepository, messageRepository, transcriptService, traceRepository } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      messageRepository.findProposal.mockResolvedValue(message({ role: "tool" }));
      traceRepository.recordCardDecision.mockResolvedValue(false);

      expect(await service.recordActionResult(CONVERSATION_ID, input)).toEqual({ recorded: true });
      expect(traceRepository.recordCardDecision).toHaveBeenCalledWith(expect.objectContaining({ proposalId: input.proposalId, decision: "confirmed" }));
      expect(transcriptService.record).toHaveBeenCalledTimes(1);
    });

    it("still records the action result and logs ASSISTANT_TURN_TRACE_FAILED when the card decision cannot be traced", async () => {
      const { service, conversationRepository, messageRepository, transcriptService, traceRepository, logger } = setup();
      const error = new Error("db down");
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      messageRepository.findProposal.mockResolvedValue(message({ role: "tool" }));
      traceRepository.recordCardDecision.mockRejectedValue(error);

      expect(await service.recordActionResult(CONVERSATION_ID, input)).toEqual({ recorded: true });
      expect(transcriptService.record).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_TURN_TRACE_FAILED", error });
    });

    it.each([[consent({ reviewOptIn: false })], [undefined]])("records nothing once the user no longer allows review (%j)", async latest => {
      const { service, conversationRepository, consentRepository, messageRepository, transcriptService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      consentRepository.findLatestByUserId.mockResolvedValue(latest);

      expect(await service.recordActionResult(CONVERSATION_ID, input)).toEqual({ recorded: false });
      expect(messageRepository.findProposal).not.toHaveBeenCalled();
      expect(transcriptService.record).not.toHaveBeenCalled();
    });

    it("refuses an unknown proposal", async () => {
      const { service, conversationRepository, messageRepository } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      messageRepository.findProposal.mockResolvedValue(undefined);

      await expect(service.recordActionResult(CONVERSATION_ID, input)).rejects.toMatchObject({ status: 404, errorCode: "assistant_proposal_not_found" });
      expect(messageRepository.findProposal).toHaveBeenCalledWith(CONVERSATION_ID, input.proposalId);
    });

    it("records the decision and redacted outcome", async () => {
      const { service, conversationRepository, messageRepository, transcriptService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      messageRepository.findProposal.mockResolvedValue(message({ role: "tool", toolName: "propose_update_deployment" }));

      const result = await service.recordActionResult(CONVERSATION_ID, { ...input, outcome: "failed", error: `rejected ${FAKE_TOKEN}` });

      expect(result).toEqual({ recorded: true });
      expect(transcriptService.record).toHaveBeenCalledWith(CONVERSATION_ID, {
        role: "tool",
        content: `update deployment, confirmed, failed, rejected ${REDACTED}`,
        toolName: "action_result",
        toolPayload: { proposalId: input.proposalId, actionType: "update_deployment", decision: "confirmed", outcome: "failed", error: `rejected ${REDACTED}` }
      });
    });

    it("records a cancelled card without an outcome", async () => {
      const { service, conversationRepository, messageRepository, transcriptService } = setup();
      conversationRepository.findOneBy.mockResolvedValue(conversation());
      messageRepository.findProposal.mockResolvedValue(message({ role: "tool" }));

      await service.recordActionResult(CONVERSATION_ID, { ...input, decision: "cancelled" });

      expect(transcriptService.record).toHaveBeenCalledWith(CONVERSATION_ID, {
        role: "tool",
        content: "update deployment, cancelled",
        toolName: "action_result",
        toolPayload: { proposalId: input.proposalId, actionType: "update_deployment", decision: "cancelled", outcome: null, error: null }
      });
    });
  });

  function pendingTurn(state: Partial<AssistantPendingTurnOutput["state"]>): AssistantPendingTurnOutput {
    return {
      conversationId: CONVERSATION_ID,
      userId: "user-1",
      state: { messages: [], clientToolCalls: [], roundsUsed: 1, stored: false, isTrialing: false, ...state },
      expiresAt: NOW,
      createdAt: NOW
    };
  }

  function setup(input: { consent?: AssistantConsentOutput; organizationId?: string; wallet?: ReturnType<typeof createUserWallet> } = {}) {
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: "user-1" }), ability: mock<MongoAbility>() });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockReturnValue(input.organizationId ? mock<OrganizationContext>({ organizationId: input.organizationId }) : undefined);
    const consentRepository = mock<AssistantConsentRepository>();
    consentRepository.accessibleBy.mockReturnValue(consentRepository);
    consentRepository.findLatestByUserId.mockResolvedValue(input.consent ?? consent());
    const conversationRepository = mock<AssistantConversationRepository>();
    conversationRepository.accessibleBy.mockReturnValue(conversationRepository);
    conversationRepository.findOneBy.mockResolvedValue(undefined);
    const messageRepository = mock<AssistantMessageRepository>();
    messageRepository.findAllOf.mockResolvedValue([]);
    const dailyCountRepository = mock<AssistantConversationDailyCountRepository>();
    const pendingTurnRepository = mock<AssistantPendingTurnRepository>();
    const traceRepository = mock<AssistantTurnTraceRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.accessibleBy.mockReturnValue(userWalletRepository);
    userWalletRepository.findOneUsedBy.mockResolvedValue("wallet" in input ? input.wallet : createUserWallet({ isTrialing: false }));
    const akashMlClient = mock<AkashMlClient>();
    akashMlClient.isAvailable.mockReturnValue(true);
    const limitsService = mock<AssistantLimitsService>();
    const transcriptService = mock<AssistantTranscriptService>();
    const turnService = mock<AssistantTurnService>();
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());
    const config = envSchema.parse({ ASSISTANT_SUPPORT_URL: "https://discord.example" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new AssistantConversationService(
      authService,
      executionContextService,
      consentRepository,
      conversationRepository,
      messageRepository,
      dailyCountRepository,
      pendingTurnRepository,
      traceRepository,
      userWalletRepository,
      akashMlClient,
      limitsService,
      transcriptService,
      turnService,
      jobQueueService,
      txService,
      config,
      createLogger
    );

    return {
      service,
      authService,
      executionContextService,
      consentRepository,
      conversationRepository,
      messageRepository,
      dailyCountRepository,
      pendingTurnRepository,
      akashMlClient,
      limitsService,
      transcriptService,
      turnService,
      jobQueueService,
      txService,
      traceRepository,
      config,
      logger
    };
  }
});
