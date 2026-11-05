import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { resolveTable } from "@src/core";
import { POSTGRES_DB } from "@src/core/providers";
import type { AssistantPendingTurnState } from "@src/feedback/model-schemas/assistant-pending-turn/assistant-pending-turn.schema";
import { AssistantPendingTurnRepository } from "./assistant-pending-turn.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const LATER = new Date("2026-11-04T12:05:00.000Z");

describe(AssistantPendingTurnRepository.name, () => {
  describe("take", () => {
    it("answers the held turn once and removes it", async () => {
      const { repository, userId, conversationId, stateOf } = await setup();
      const state = stateOf(2);
      await repository.hold({ conversationId, userId, state, expiresAt: LATER });

      expect(await repository.take(conversationId, userId, NOW)).toMatchObject({ conversationId, userId, state, expiresAt: LATER });
      expect(await repository.take(conversationId, userId, NOW)).toBeUndefined();
    });

    it("answers nothing for a turn that expired, nor for another user", async () => {
      const { repository, userId, conversationId, stateOf } = await setup();
      const other = await seedUser();
      await repository.hold({ conversationId, userId, state: stateOf(1), expiresAt: LATER });

      expect(await repository.take(conversationId, other.id, NOW)).toBeUndefined();
      expect(await repository.take(conversationId, userId, LATER)).toBeUndefined();
    });
  });

  describe("hold", () => {
    it("replaces the turn the user held on the same conversation", async () => {
      const { repository, userId, conversationId, stateOf } = await setup();
      await repository.hold({ conversationId, userId, state: stateOf(1), expiresAt: NOW });

      await repository.hold({ conversationId, userId, state: stateOf(3), expiresAt: LATER });

      expect(await repository.take(conversationId, userId, NOW)).toMatchObject({ state: stateOf(3), expiresAt: LATER });
    });

    it("never replaces a turn another user holds on the same conversation id", async () => {
      const { repository, userId, conversationId, stateOf } = await setup();
      const other = await seedUser();
      await repository.hold({ conversationId, userId, state: stateOf(1), expiresAt: LATER });

      await repository.hold({ conversationId, userId: other.id, state: stateOf(5), expiresAt: LATER });

      expect(await repository.take(conversationId, userId, NOW)).toMatchObject({ state: stateOf(1) });
    });
  });

  describe("release", () => {
    it("removes only the user's turn", async () => {
      const { repository, userId, conversationId, stateOf, exists } = await setup();
      const other = await seedUser();
      await repository.hold({ conversationId, userId, state: stateOf(1), expiresAt: LATER });

      await repository.release(conversationId, other.id);
      expect(await exists(conversationId)).toBe(true);

      await repository.release(conversationId, userId);
      expect(await exists(conversationId)).toBe(false);
    });
  });

  describe("deleteExpired", () => {
    it("removes the turns that expired and answers how many", async () => {
      const { repository, userId, stateOf, exists } = await setup();
      const expired = faker.string.uuid();
      const live = faker.string.uuid();
      await repository.hold({ conversationId: expired, userId, state: stateOf(1), expiresAt: new Date("2020-01-01T00:00:00.000Z") });
      await repository.hold({ conversationId: live, userId, state: stateOf(1), expiresAt: new Date("2100-01-01T00:00:00.000Z") });

      expect(await repository.deleteExpired(NOW)).toBeGreaterThanOrEqual(1);
      expect(await exists(expired)).toBe(false);
      expect(await exists(live)).toBe(true);
    });
  });

  async function setup() {
    const user = await seedUser();
    const table = resolveTable("AssistantPendingTurns");
    const db = container.resolve(POSTGRES_DB);
    const exists = async (conversationId: string) => (await db.select().from(table).where(eq(table.conversationId, conversationId))).length > 0;
    const stateOf = (roundsUsed: number): AssistantPendingTurnState => ({
      messages: [{ role: "user", content: "Why is my deployment down?" }],
      clientToolCalls: [{ id: "call-1", type: "function", function: { name: "read_logs", arguments: JSON.stringify({ dseq: "123" }) } }],
      roundsUsed,
      stored: false,
      isTrialing: false
    });

    return { repository: container.resolve(AssistantPendingTurnRepository), userId: user.id, conversationId: faker.string.uuid(), stateOf, exists };
  }
});
