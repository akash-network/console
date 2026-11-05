import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { AssistantStreamEvent } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import { FEEDBACK_CONFIG } from "@src/feedback/providers/config.provider";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { AssistantMessageRepository } from "@src/feedback/repositories/assistant-message/assistant-message.repository";
import { AkashMlClient } from "@src/feedback/services/akashml-client/akashml.client";
import { ClassifyConversation } from "@src/feedback/services/classify-conversation/classify-conversation.handler";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedAssistantConsent, seedAssistantConversation } from "@test/seeders/db/feedback.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const COPY_VERSION = "2026-11-01";
const FAKE_TOKEN = `ghp_${"Z9y8X7w6V5".repeat(3)}`;

type CompletionReply = { content?: string | null; toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[] };

describe("Assistant conversations", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const assistantConversationRepository = container.resolve(AssistantConversationRepository);
  const assistantMessageRepository = container.resolve(AssistantMessageRepository);
  const config = container.resolve(FEEDBACK_CONFIG);
  const db = container.resolve(POSTGRES_DB);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/assistant/conversations", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      const response = await request("/v1/assistant/conversations", undefined, { copyVersion: COPY_VERSION });

      expect(response.status).toBe(401);
    });

    it("returns 404 while the feature flag is off", async () => {
      const { token } = await setup({ flagOn: false, consent: { reviewOptIn: true } });

      const response = await request("/v1/assistant/conversations", token, { copyVersion: COPY_VERSION });

      expect(response.status).toBe(404);
    });

    it("refuses a user who never agreed to the assistant", async () => {
      const { token } = await setup();

      const response = await request("/v1/assistant/conversations", token, { copyVersion: COPY_VERSION });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "assistant_consent_required" });
    });

    it("refuses a copy version other than the one the user agreed to", async () => {
      const { token } = await setup({ consent: { reviewOptIn: true } });

      const response = await request("/v1/assistant/conversations", token, { copyVersion: "2027-01-01" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "assistant_consent_outdated" });
    });

    it("stores the conversation with its context when the user allowed review", async () => {
      const { user, token } = await setup({ consent: { reviewOptIn: true } });

      const response = await request("/v1/assistant/conversations", token, { copyVersion: COPY_VERSION, context: { page: "/deployments", dseq: "1234" } });
      const { data } = (await response.json()) as { data: { id: string; stored: boolean } };

      expect(response.status).toBe(201);
      expect(data.stored).toBe(true);
      expect(await assistantConversationRepository.findById(data.id)).toMatchObject({
        userId: user.id,
        status: "open",
        context: { page: "/deployments", dseq: "1234" }
      });
    });

    it("stores nothing when the user did not allow review", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });

      const response = await request("/v1/assistant/conversations", token, { copyVersion: COPY_VERSION });
      const { data } = (await response.json()) as { data: { id: string; stored: boolean } };

      expect(response.status).toBe(201);
      expect(data.stored).toBe(false);
      expect(await assistantConversationRepository.findById(data.id)).toBeUndefined();
    });
  });

  describe("POST /v1/assistant/conversations/{id}/messages", () => {
    it("answers assistant_unavailable when the assistant has no model access", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false }, available: false });

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Hi" });

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "assistant_unavailable" });
    });

    it("refuses a message once the user sent too many this minute", async () => {
      const { user, token } = await setup({ consent: { reviewOptIn: false } });
      await db.insert(resolveTable("AssistantUserUsage")).values({
        userId: user.id,
        day: new Date().toISOString().slice(0, 10),
        dayMessageCount: config.ASSISTANT_MESSAGES_PER_MINUTE,
        minuteStartedAt: new Date(),
        minuteMessageCount: config.ASSISTANT_MESSAGES_PER_MINUTE
      });

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Hi" });

      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: "assistant_rate_limited" });
    });

    it("streams the answer after running a server tool, and stores the redacted transcript", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id });
      const completions = replyWith([
        { toolCalls: [{ id: "call-1", name: "search_docs", arguments: { query: "persistent storage" } }] },
        { content: "Add a persistent storage volume to the profile." }
      ]);

      const response = await request(`/v1/assistant/conversations/${conversation.id}/messages`, token, {
        content: `How do I keep my data? My token is ${FAKE_TOKEN}`
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(await eventsOf(response)).toEqual([
        { type: "tool_started", toolCallId: "call-1", name: "search_docs" },
        { type: "tool_result_summary", toolCallId: "call-1", name: "search_docs", ok: true, summary: expect.any(String) },
        { type: "text_delta", text: "Add a persistent storage volume to the profile." },
        { type: "done", reason: "stop" }
      ]);
      expect(JSON.stringify(completions.bodies[0])).not.toContain(FAKE_TOKEN);
      expect(JSON.stringify(completions.bodies[0])).toContain(REDACTED);
      expect(await assistantMessageRepository.findAllOf(conversation.id)).toMatchObject([
        { role: "user", content: expect.stringContaining(REDACTED) },
        { role: "tool", toolName: "search_docs" },
        { role: "assistant", content: "Add a persistent storage volume to the profile." }
      ]);
    });

    it("stores nothing for a conversation the user did not allow review of, and replays the history the browser sends", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const conversationId = faker.string.uuid();
      const completions = replyWith([{ content: "Yes, the same SDL works." }]);

      const response = await request(`/v1/assistant/conversations/${conversationId}/messages`, token, {
        content: "Does it still work?",
        history: [
          { role: "user", content: "Can I deploy nginx?" },
          { role: "assistant", content: "Yes." }
        ]
      });

      expect(await eventsOf(response)).toEqual([
        { type: "text_delta", text: "Yes, the same SDL works." },
        { type: "done", reason: "stop" }
      ]);
      expect(completions.bodies[0].messages.slice(1)).toEqual([
        { role: "user", content: "Can I deploy nginx?" },
        { role: "assistant", content: "Yes." },
        { role: "user", content: "Does it still work?" }
      ]);
      expect(await assistantMessageRepository.findAllOf(conversationId)).toEqual([]);
    });

    it("refuses a message to a conversation that ended", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id, status: "resolved", endedAt: new Date() });

      const response = await request(`/v1/assistant/conversations/${conversation.id}/messages`, token, { content: "Hi" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "assistant_conversation_ended" });
    });

    it("streams an action proposal and never executes it", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id });
      replyWith([{ toolCalls: [{ id: "call-1", name: "propose_buy_credits", arguments: { amountUsd: 20 } }] }, { content: "Here is a card to add credits." }]);

      const events = await eventsOf(await request(`/v1/assistant/conversations/${conversation.id}/messages`, token, { content: "I need more credits" }));

      expect(events).toContainEqual({
        type: "action_proposal",
        proposalId: expect.any(String),
        action: { type: "buy_credits", tier: "deep_link", amountUsd: 20 }
      });
      expect(events.at(-1)).toEqual({ type: "done", reason: "stop" });
    });
  });

  describe("POST /v1/assistant/conversations/{id}/client-tool-results", () => {
    it("pauses the turn on a browser tool and resumes it with the redacted excerpt", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const conversationId = faker.string.uuid();
      const completions = replyWith([
        { toolCalls: [{ id: "call-logs", name: "read_logs", arguments: { dseq: "1234", tailLines: 50 } }] },
        { content: "The container exits because the port is taken." }
      ]);

      const paused = await eventsOf(await request(`/v1/assistant/conversations/${conversationId}/messages`, token, { content: "Why does it crash?" }));
      const resumed = await request(`/v1/assistant/conversations/${conversationId}/client-tool-results`, token, {
        results: [{ toolCallId: "call-logs", content: `listen EADDRINUSE\npassword=${FAKE_TOKEN}` }]
      });

      expect(paused).toEqual([
        { type: "tool_started", toolCallId: "call-logs", name: "read_logs" },
        {
          type: "client_tool_request",
          toolCallId: "call-logs",
          name: "read_logs",
          arguments: { dseq: "1234", tailLines: 50 },
          maxLength: expect.any(Number)
        },
        { type: "done", reason: "awaiting_client_tool" }
      ]);
      expect(await eventsOf(resumed)).toEqual([
        { type: "text_delta", text: "The container exits because the port is taken." },
        { type: "done", reason: "stop" }
      ]);
      const toolMessage = completions.bodies[1].messages.at(-1)!;
      expect(toolMessage).toMatchObject({ role: "tool", tool_call_id: "call-logs" });
      expect(toolMessage.content).toContain("EADDRINUSE");
      expect(toolMessage.content).not.toContain(FAKE_TOKEN);
    });

    it("refuses results when the assistant is not waiting on the browser", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/client-tool-results`, token, {
        results: [{ toolCallId: "call-logs", content: "logs" }]
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "assistant_no_pending_tool_request" });
    });

    it("refuses results that do not answer the requested calls", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const conversationId = faker.string.uuid();
      replyWith([{ toolCalls: [{ id: "call-logs", name: "read_events", arguments: { dseq: "1234" } }] }]);
      await eventsOf(await request(`/v1/assistant/conversations/${conversationId}/messages`, token, { content: "What happened?" }));

      const response = await request(`/v1/assistant/conversations/${conversationId}/client-tool-results`, token, {
        results: [{ toolCallId: "call-other", content: "events" }]
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "assistant_tool_results_mismatch" });
    });
  });

  describe("POST /v1/assistant/conversations/{id}/end", () => {
    it("ends a stored conversation once, counts it and queues its classification", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id });
      const before = await resolvedCountToday();

      const first = await request(`/v1/assistant/conversations/${conversation.id}/end`, token, { resolvedByUser: true });
      const second = await request(`/v1/assistant/conversations/${conversation.id}/end`, token, { resolvedByUser: false });

      expect(first.status).toBe(200);
      expect(await first.json()).toEqual({ data: { id: conversation.id, status: "resolved" } });
      expect(await second.json()).toEqual({ data: { id: conversation.id, status: "resolved" } });
      expect(await assistantConversationRepository.findById(conversation.id)).toMatchObject({
        status: "resolved",
        resolvedByUser: true,
        endedAt: expect.any(Date)
      });
      expect(await resolvedCountToday()).toBe(before + 1);
      const jobs = await findJobRows<{ conversationId: string }>(ClassifyConversation[JOB_NAME]);
      expect(jobs.filter(job => job.data.conversationId === conversation.id)).toHaveLength(1);
    });

    it("counts a conversation it does not store as unresolved unless the user says otherwise", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const conversationId = faker.string.uuid();
      const before = await unresolvedCountToday();

      const response = await request(`/v1/assistant/conversations/${conversationId}/end`, token, {});

      expect(await response.json()).toEqual({ data: { id: conversationId, status: "unresolved" } });
      expect(await unresolvedCountToday()).toBe(before + 1);
    });
  });

  describe("POST /v1/assistant/conversations/{id}/action-results", () => {
    it("records what the user did with a proposal of a stored conversation", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id });
      const proposalId = faker.string.uuid();
      await db.insert(resolveTable("AssistantMessages")).values({
        conversationId: conversation.id,
        role: "tool",
        content: "Proposed adding credits",
        toolName: "propose_buy_credits",
        toolPayload: { toolCallId: "call-1", proposalId, action: { type: "buy_credits", tier: "deep_link", amountUsd: 20 } }
      });

      const response = await request(`/v1/assistant/conversations/${conversation.id}/action-results`, token, {
        proposalId,
        actionType: "buy_credits",
        decision: "confirmed",
        outcome: "failed",
        error: `Card declined for ${FAKE_TOKEN}`
      });

      expect(await response.json()).toEqual({ data: { recorded: true } });
      expect((await assistantMessageRepository.findAllOf(conversation.id)).at(-1)).toMatchObject({
        role: "tool",
        toolName: "action_result",
        toolPayload: { proposalId, actionType: "buy_credits", decision: "confirmed", outcome: "failed", error: expect.stringContaining(REDACTED) }
      });
    });

    it("refuses a proposal the conversation never made", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: true } });
      const conversation = await seedAssistantConversation({ userId: user.id });

      const response = await request(`/v1/assistant/conversations/${conversation.id}/action-results`, token, {
        proposalId: faker.string.uuid(),
        actionType: "buy_credits",
        decision: "cancelled"
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "assistant_proposal_not_found" });
    });

    it("records nothing for a conversation it does not store", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/action-results`, token, {
        proposalId: faker.string.uuid(),
        actionType: "buy_credits",
        decision: "cancelled"
      });

      expect(await response.json()).toEqual({ data: { recorded: false } });
    });
  });

  async function request(path: string, token?: string, data?: Record<string, unknown>) {
    return await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify({ data }) } : {})
    });
  }

  async function eventsOf(response: Response): Promise<AssistantStreamEvent[]> {
    const body = await response.text();

    return body
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => JSON.parse(line.slice("data: ".length)));
  }

  function replyWith(replies: CompletionReply[]) {
    const bodies: { messages: { role: string; content: string; tool_call_id?: string }[] }[] = [];
    const scope = nock(config.AKASHML_API_URL);

    for (const reply of replies) {
      scope.post("/chat/completions").reply(200, (_uri, body) => {
        bodies.push(body as (typeof bodies)[number]);

        return {
          choices: [
            {
              finish_reason: reply.toolCalls ? "tool_calls" : "stop",
              message: {
                role: "assistant",
                content: reply.content ?? null,
                tool_calls: reply.toolCalls?.map(call => ({
                  id: call.id,
                  type: "function",
                  function: { name: call.name, arguments: JSON.stringify(call.arguments) }
                }))
              }
            }
          ],
          usage: { prompt_tokens: 100, completion_tokens: 10 }
        };
      });
    }

    return { bodies };
  }

  async function countsToday() {
    const table = resolveTable("AssistantConversationDailyCounts");
    const [counts] = await db
      .select()
      .from(table)
      .where(eq(table.day, new Date().toISOString().slice(0, 10)));

    return counts ?? { resolvedCount: 0, unresolvedCount: 0 };
  }

  async function resolvedCountToday() {
    return (await countsToday()).resolvedCount;
  }

  async function unresolvedCountToday() {
    return (await countsToday()).unresolvedCount;
  }

  async function setup(input: { flagOn?: boolean; consent?: { reviewOptIn: boolean }; available?: boolean } = {}) {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const token = faker.string.alphanumeric(40);
    if (input.consent) await seedAssistantConsent({ userId: user.id, copyVersion: COPY_VERSION, reviewOptIn: input.consent.reviewOptIn });

    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      flag => flag === FeatureFlags.USER_FEEDBACK_LOOP && input.flagOn !== false
    );
    vi.spyOn(container.resolve(AkashMlClient), "isAvailable").mockReturnValue(input.available !== false);

    return { user, token };
  }
});
