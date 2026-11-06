import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { load } from "js-yaml";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
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

import { createApiKey } from "@test/seeders/api-key.seeder";
import { seedAssistantConsent, seedAssistantConversation } from "@test/seeders/db/feedback.seeder";
import { ASSISTANT_TEST_SDL } from "@test/seeders/get-deployment-response.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const COPY_VERSION = "2026-11-01";
const FAKE_TOKEN = `ghp_${"Z9y8X7w6V5".repeat(3)}`;

type CompletionReply = { content?: string | null; toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[] };

describe("Assistant conversations", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const assistantConversationRepository = container.resolve(AssistantConversationRepository);
  const assistantMessageRepository = container.resolve(AssistantMessageRepository);
  const apiKeyRepository = container.resolve(ApiKeyRepository);
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
      expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
      expect(response.headers.get("x-accel-buffering")).toBe("no");
      const events = await eventsOf(response);
      expect(events).toEqual([
        { type: "secret_redacted", count: 1 },
        { type: "tool_started", toolCallId: "call-1", name: "search_docs" },
        { type: "tool_result_summary", toolCallId: "call-1", name: "search_docs", ok: true, summary: expect.any(String) },
        ...textDeltasOf("Add a persistent storage volume to the profile."),
        { type: "done", reason: "stop" }
      ]);
      expect(JSON.stringify(events)).not.toContain(FAKE_TOKEN);
      expect(JSON.stringify(events)).not.toMatch(/ghp|github/i);
      expect(completions.bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
      expect(JSON.stringify(completions.bodies[0])).not.toContain(FAKE_TOKEN);
      expect(JSON.stringify(completions.bodies[0])).toContain(REDACTED);
      expect(await assistantMessageRepository.findAllOf(conversation.id)).toMatchObject([
        { role: "user", content: expect.stringContaining(REDACTED) },
        { role: "tool", toolName: "search_docs" },
        { role: "assistant", content: "Add a persistent storage volume to the profile." }
      ]);
    });

    it("reads the Console API as the signed-in user, showing only their own data and none of its key material", async () => {
      const { token, user } = await setup({ consent: { reviewOptIn: false } });
      const { user: otherUser } = await setup();
      const ownKey = await seedApiKey({ userId: user.id, name: "ci deploy key" });
      await seedApiKey({ userId: otherUser.id, name: "someone else's key" });
      const completions = replyWith([
        { toolCalls: [{ id: "call-1", name: "read_console_api", arguments: { path: "/v1/api-keys" } }] },
        { content: "You have one API key, ci deploy key." }
      ]);

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Which API keys do I have?" });

      expect(await eventsOf(response)).toEqual([
        { type: "tool_started", toolCallId: "call-1", name: "read_console_api" },
        { type: "tool_result_summary", toolCallId: "call-1", name: "read_console_api", ok: true, summary: "Read your API keys" },
        ...textDeltasOf("You have one API key, ci deploy key."),
        { type: "done", reason: "stop" }
      ]);
      const toolMessage = completions.bodies[1].messages.at(-1)!;
      expect(toolMessage).toMatchObject({ role: "tool", tool_call_id: "call-1" });
      expect(JSON.parse(toolMessage.content)).toMatchObject({
        tool: "read_console_api",
        data: { data: [{ id: ownKey.id, name: "ci deploy key", keyFormat: REDACTED }] }
      });
      expect(toolMessage.content).not.toContain("someone else's key");
      expect(toolMessage.content).not.toContain(ownKey.keyFormat);
      expect(toolMessage.content).not.toContain(ownKey.hashedKey);
      expect(toolMessage.content).not.toContain("hashedKey");
      const readTool = (completions.bodies[0] as unknown as { tools: { function: { name: string; description: string } }[] }).tools.find(
        tool => tool.function.name === "read_console_api"
      );
      expect(readTool?.function.description).toContain("/v1/api-keys");
      expect(readTool?.function.description).not.toContain("/v1/sdl-secrets-context");
    });

    it("refuses a denied Console API route without reading it", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const completions = replyWith([
        { toolCalls: [{ id: "call-1", name: "read_console_api", arguments: { path: "/v1/sdl-secrets-context" } }] },
        { content: "I cannot read that." }
      ]);

      const response = await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Show me my SDL secrets context." });

      expect(await eventsOf(response)).toContainEqual({
        type: "tool_result_summary",
        toolCallId: "call-1",
        name: "read_console_api",
        ok: false,
        summary: "Could not read your Console data"
      });
      expect(JSON.parse(completions.bodies[1].messages.at(-1)!.content)).toEqual({
        tool: "read_console_api",
        error: "/v1/sdl-secrets-context is not available to the assistant. Do not try it again; tell the user where Console shows it instead."
      });
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

      expect(await eventsOf(response)).toEqual([...textDeltasOf("Yes, the same SDL works."), { type: "done", reason: "stop" }]);
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

    it("streams a generated SDL at Console's default price ceiling, whatever price the model wrote", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const crazyPricedSdl = ASSISTANT_TEST_SDL.replace("denom: uact\n          amount: 1000", "denom: uakt\n          amount: 999999999");
      replyWith([
        { toolCalls: [{ id: "call-1", name: "propose_open_in_editor", arguments: { sdl: crazyPricedSdl } }] },
        { content: "Here is the SDL in the editor." }
      ]);

      const events = await eventsOf(await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Write me an nginx SDL" }));

      const proposal = events.find(event => event.type === "action_proposal") as Extract<AssistantStreamEvent, { type: "action_proposal" }>;
      const { sdl } = proposal.action as Extract<typeof proposal.action, { type: "open_in_editor" }>;
      expect(load(sdl!)).toMatchObject({ profiles: { placement: { dcloud: { pricing: { web: { denom: "uact", amount: 100000 } } } } } });
    });

    it("streams the redacted diagnosis behind a proposed fix", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      const diagnosis = { summary: "The provider reclaimed its capacity.", evidence: ["lease closed: provider", `password=${FAKE_TOKEN}`] };
      replyWith([
        { toolCalls: [{ id: "call-1", name: "propose_open_in_editor", arguments: { dseq: "42", diagnosis } }] },
        { content: "Here is a card to redeploy it." }
      ]);

      const events = await eventsOf(
        await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "Why did my deployment stop?" })
      );

      expect(events).toContainEqual({
        type: "action_proposal",
        proposalId: expect.any(String),
        action: { type: "open_in_editor", tier: "deep_link", dseq: "42", templateId: null, sdl: null },
        diagnosis: { summary: "The provider reclaimed its capacity.", evidence: ["lease closed: provider", "password=[REDACTED]"] }
      });
    });

    it("streams a typed live help signal when the assistant cannot help", async () => {
      const { token } = await setup({ consent: { reviewOptIn: false } });
      replyWith([
        { toolCalls: [{ id: "call-1", name: "suggest_live_help", arguments: { reason: "provider_side_issue" } }] },
        { content: "This needs the provider. Ask on Discord." }
      ]);

      const events = await eventsOf(await request(`/v1/assistant/conversations/${faker.string.uuid()}/messages`, token, { content: "My provider vanished" }));

      expect(events).toEqual([
        { type: "live_help_suggested", reason: "provider_side_issue" },
        ...textDeltasOf("This needs the provider. Ask on Discord."),
        { type: "done", reason: "stop" }
      ]);
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
      expect(await eventsOf(resumed)).toEqual([...textDeltasOf("The container exits because the port is taken."), { type: "done", reason: "stop" }]);
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

  function textDeltasOf(text: string): AssistantStreamEvent[] {
    return wordsOf(text).map(word => ({ type: "text_delta", text: word }));
  }

  function wordsOf(text: string): string[] {
    return text.split(/(?<= )/);
  }

  function replyWith(replies: CompletionReply[]) {
    const bodies: { stream?: boolean; messages: { role: string; content: string; tool_call_id?: string }[] }[] = [];
    const scope = nock(config.AKASHML_API_URL);

    for (const reply of replies) {
      scope.post("/chat/completions").reply(
        200,
        (_uri, body) => {
          bodies.push(body as (typeof bodies)[number]);

          return streamedChunksOf(reply)
            .map(chunk => `data: ${JSON.stringify(chunk)}\n\n`)
            .concat("data: [DONE]\n\n")
            .join("");
        },
        { "Content-Type": "text/event-stream" }
      );
    }

    return { bodies };
  }

  function streamedChunksOf(reply: CompletionReply): Record<string, unknown>[] {
    const choice = (delta: Record<string, unknown>, finishReason: string | null = null) => ({ choices: [{ index: 0, delta, finish_reason: finishReason }] });
    const toolCallChunks = (reply.toolCalls ?? []).flatMap((call, index) => {
      const args = JSON.stringify(call.arguments);
      const half = Math.floor(args.length / 2);

      return [
        choice({ tool_calls: [{ index, id: call.id, type: "function", function: { name: call.name, arguments: args.slice(0, half) } }] }),
        choice({ tool_calls: [{ index, function: { arguments: args.slice(half) } }] })
      ];
    });

    return [
      choice({ role: "assistant", content: null, reasoning: "Thinking about the question." }),
      ...wordsOf(reply.content ?? "")
        .filter(Boolean)
        .map(word => choice({ content: word })),
      ...toolCallChunks,
      choice({}, reply.toolCalls ? "tool_calls" : "stop"),
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10 } }
    ];
  }

  async function seedApiKey(input: { userId: string; name: string }) {
    const apiKey = createApiKey(input);
    await apiKeyRepository.create({
      ...apiKey,
      createdAt: new Date(apiKey.createdAt),
      updatedAt: new Date(apiKey.updatedAt),
      expiresAt: null,
      lastUsedAt: null
    });

    return apiKey;
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
