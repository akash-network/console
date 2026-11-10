import { faker } from "@faker-js/faker";
import { subDays, subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type AssistantTurnTraceInput, AssistantTurnTraceRepository, type AssistantTurnTraceResult } from "./assistant-turn-trace.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantTurnTraceRepository.name, () => {
  describe("create", () => {
    it("stores a trace and reads it back by conversation", async () => {
      const { repository, userId, findByConversation } = await setup();
      const organization = await seedOrganization();
      const trace = {
        userId,
        organizationId: organization.id,
        conversationId: faker.string.uuid(),
        page: "/deployments/123",
        model: "assistant-model",
        promptVersion: "2026-11-08",
        outcome: "recovered",
        startedAt: subMinutes(new Date(), 5),
        firstTokenMs: 420,
        durationMs: 3100,
        promptTokens: 1200,
        completionTokens: 80,
        toolCalls: [
          { name: "get_deployment", ok: false, durationMs: 150 },
          { name: "get_deployment", ok: true, durationMs: 90 }
        ],
        cards: [{ proposalId: "p1", actionType: "close_deployment", decision: null }]
      } satisfies AssistantTurnTraceInput;

      await repository.create(trace);

      expect(await findByConversation(trace.conversationId)).toEqual([{ id: expect.any(String), ...trace }]);
    });

    it("defaults tokens, tool calls and cards to empty", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();

      await repository.create(traceOf({ userId, conversationId }));

      expect(await findByConversation(conversationId)).toEqual([
        expect.objectContaining({ organizationId: null, page: null, firstTokenMs: null, promptTokens: 0, completionTokens: 0, toolCalls: [], cards: [] })
      ]);
    });
  });

  describe("start", () => {
    it("stores a running trace with nothing counted yet and returns its id", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();

      const id = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0 });

      expect(await findByConversation(conversationId)).toEqual([
        expect.objectContaining({ id, outcome: "running", durationMs: 0, promptTokens: 0, toolCalls: [], cards: [] })
      ]);
    });
  });

  describe("appendCard", () => {
    it("adds each card after the ones already on the trace", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();
      const id = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0 });
      const otherId = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0 });

      await repository.appendCard(id, { proposalId: "p1", actionType: "close_deployment", decision: null });
      await repository.appendCard(id, { proposalId: "p2", actionType: "send_manifest_again", decision: null });

      const traces = await findByConversation(conversationId);
      expect(traces.find(trace => trace.id === id)?.cards).toEqual([
        { proposalId: "p1", actionType: "close_deployment", decision: null },
        { proposalId: "p2", actionType: "send_manifest_again", decision: null }
      ]);
      expect(traces.find(trace => trace.id === otherId)?.cards).toEqual([]);
    });
  });

  describe("finish", () => {
    it("keeps a recorded decision when the turn finishes", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();
      const id = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0 });
      await repository.appendCard(id, { proposalId: "p1", actionType: "close_deployment", decision: null });
      await repository.recordCardDecision({ userId, conversationId, proposalId: "p1", decision: "confirmed" });
      const result = {
        outcome: "answered",
        firstTokenMs: 300,
        durationMs: 2400,
        promptTokens: 900,
        completionTokens: 60,
        toolCalls: [{ name: "propose_close_deployment", ok: true, durationMs: 40 }]
      } satisfies AssistantTurnTraceResult;

      await repository.finish(id, result);

      expect(await findByConversation(conversationId)).toEqual([
        expect.objectContaining({ id, ...result, cards: [{ proposalId: "p1", actionType: "close_deployment", decision: "confirmed" }] })
      ]);
    });
  });

  describe("recordCardDecision", () => {
    it("records two decisions on the same trace at once", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();
      const cards = [
        { proposalId: "p1", actionType: "close_deployment", decision: null },
        { proposalId: "p2", actionType: "send_manifest_again", decision: null }
      ];
      await repository.create({ ...traceOf({ userId, conversationId }), cards });

      expect(
        await Promise.all([
          repository.recordCardDecision({ userId, conversationId, proposalId: "p1", decision: "confirmed" }),
          repository.recordCardDecision({ userId, conversationId, proposalId: "p2", decision: "dismissed" })
        ])
      ).toEqual([true, true]);

      expect((await findByConversation(conversationId))[0].cards).toEqual([
        { proposalId: "p1", actionType: "close_deployment", decision: "confirmed" },
        { proposalId: "p2", actionType: "send_manifest_again", decision: "dismissed" }
      ]);
    });

    it("keeps every decision when many cards on one trace are decided at once", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();
      const proposalIds = Array.from({ length: 8 }, (_, index) => `p${index}`);
      await repository.create({
        ...traceOf({ userId, conversationId }),
        cards: proposalIds.map(proposalId => ({ proposalId, actionType: "close_deployment", decision: null }))
      });

      await Promise.all(proposalIds.map(proposalId => repository.recordCardDecision({ userId, conversationId, proposalId, decision: "dismissed" })));

      expect((await findByConversation(conversationId))[0].cards).toEqual(
        proposalIds.map(proposalId => ({ proposalId, actionType: "close_deployment", decision: "dismissed" }))
      );
    });

    it("records a card decision only on the owner's trace that proposed it", async () => {
      const { repository, userId, findByConversation } = await setup();
      const other = await seedUser();
      const conversationId = faker.string.uuid();
      const otherCard = { proposalId: "p2", actionType: "close_deployment", decision: null };
      await repository.create({
        ...traceOf({ userId: other.id, conversationId }),
        cards: [{ proposalId: "p1", actionType: "close_deployment", decision: null }]
      });
      await repository.create({
        ...traceOf({ userId, conversationId }),
        cards: [{ proposalId: "p1", actionType: "close_deployment", decision: null }, otherCard]
      });

      expect(await repository.recordCardDecision({ userId, conversationId, proposalId: "p1", decision: "confirmed" })).toBe(true);

      const traces = await findByConversation(conversationId);
      expect(traces.find(trace => trace.userId === userId)?.cards).toEqual([
        { proposalId: "p1", actionType: "close_deployment", decision: "confirmed" },
        otherCard
      ]);
      expect(traces.find(trace => trace.userId === other.id)?.cards).toEqual([{ proposalId: "p1", actionType: "close_deployment", decision: null }]);
    });

    it("returns false for a proposal no trace holds", async () => {
      const { repository, userId, findByConversation } = await setup();
      const conversationId = faker.string.uuid();
      const cards = [{ proposalId: "p1", actionType: "close_deployment", decision: null }];
      await repository.create({ ...traceOf({ userId, conversationId }), cards });

      expect(await repository.recordCardDecision({ userId, conversationId, proposalId: "missing", decision: "confirmed" })).toBe(false);
      expect((await findByConversation(conversationId))[0].cards).toEqual(cards);
    });
  });

  describe("deleteStartedBefore", () => {
    it("deletes traces started before the cutoff", async () => {
      const { repository, userId, findByConversation } = await setup();
      const now = new Date();
      const conversationId = faker.string.uuid();
      await repository.create({ ...traceOf({ userId, conversationId }), startedAt: subDays(now, 91) });
      await repository.create({ ...traceOf({ userId, conversationId }), startedAt: subDays(now, 89) });

      expect(await repository.deleteStartedBefore(subDays(now, 90))).toBeGreaterThanOrEqual(1);
      expect(await findByConversation(conversationId)).toEqual([expect.objectContaining({ startedAt: subDays(now, 89) })]);
    });
  });

  describe("markAbandoned", () => {
    it("marks running traces older than the cutoff as failed", async () => {
      const { repository, userId, findByConversation } = await setup();
      const now = new Date();
      const cutoff = subMinutes(now, 10);
      const conversationId = faker.string.uuid();
      const abandonedId = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0, startedAt: subMinutes(now, 11) });
      const runningId = await repository.start({ ...traceOf({ userId, conversationId }), outcome: "running", durationMs: 0, startedAt: subMinutes(now, 9) });
      const answeredId = await repository.start({ ...traceOf({ userId, conversationId }), startedAt: subMinutes(now, 11) });

      expect(await repository.markAbandoned(cutoff)).toBe(1);

      const outcomes = Object.fromEntries((await findByConversation(conversationId)).map(trace => [trace.id, trace.outcome]));
      expect(outcomes).toEqual({ [abandonedId]: "failed", [runningId]: "running", [answeredId]: "answered" });
    });
  });

  describe("deleteAllOf", () => {
    it("deletes every trace of one user", async () => {
      const { repository, userId, findByConversation } = await setup();
      const other = await seedUser();
      const conversationId = faker.string.uuid();
      await repository.create(traceOf({ userId, conversationId }));
      await repository.create(traceOf({ userId, conversationId }));
      await repository.create(traceOf({ userId: other.id, conversationId }));

      expect(await repository.deleteAllOf(userId)).toBe(2);
      expect(await findByConversation(conversationId)).toEqual([expect.objectContaining({ userId: other.id })]);
    });
  });

  function traceOf(input: { userId: string; conversationId: string }): AssistantTurnTraceInput {
    return {
      ...input,
      model: "assistant-model",
      promptVersion: "2026-11-08",
      outcome: "answered",
      startedAt: new Date(),
      durationMs: 1000
    };
  }

  async function setup() {
    const user = await seedUser();
    const repository = container.resolve(AssistantTurnTraceRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("AssistantTurnTraces");
    const findByConversation = (conversationId: string) => db.select().from(table).where(eq(table.conversationId, conversationId));

    return { repository, userId: user.id, findByConversation };
  }
});
