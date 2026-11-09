import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type AssistantTurnTraceInput, AssistantTurnTraceRepository } from "./assistant-turn-trace.repository";

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
        startedAt: new Date("2026-11-08T10:00:00.000Z"),
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

  describe("recordCardDecision", () => {
    it("records a card decision only on the owner's trace that proposed it", async () => {
      const { repository, userId, findByConversation } = await setup();
      const other = await seedUser();
      const conversationId = faker.string.uuid();
      const otherCard = { proposalId: "p2", actionType: "close_deployment", decision: null };
      await repository.create({ ...traceOf({ userId: other.id, conversationId }), cards: [{ proposalId: "p1", actionType: "close_deployment", decision: null }] });
      await repository.create({ ...traceOf({ userId, conversationId }), cards: [{ proposalId: "p1", actionType: "close_deployment", decision: null }, otherCard] });

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

      expect(await repository.deleteStartedBefore(subDays(now, 90))).toBe(1);
      expect(await findByConversation(conversationId)).toEqual([expect.objectContaining({ startedAt: subDays(now, 89) })]);
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
