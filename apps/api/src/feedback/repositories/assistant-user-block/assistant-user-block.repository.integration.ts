import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { AssistantUserBlockRepository } from "./assistant-user-block.repository";

import { seedAssistantUserBlock } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const MIDNIGHT = new Date("2026-11-05T00:00:00.000Z");

describe(AssistantUserBlockRepository.name, () => {
  describe("isBlocked", () => {
    it("answers true while a block runs until a later time or has no end", async () => {
      const { repository, userId } = await setup();
      const permanent = await seedUser();
      await seedAssistantUserBlock({ userId, source: "automatic", blockedUntil: MIDNIGHT });
      await seedAssistantUserBlock({ userId: permanent.id, blockedUntil: null });

      expect(await repository.isBlocked(userId, NOW)).toBe(true);
      expect(await repository.isBlocked(permanent.id, NOW)).toBe(true);
    });

    it("answers false once the block ended or was lifted, and for a user who was never blocked", async () => {
      const { repository, userId } = await setup();
      const lifted = await seedUser();
      const never = await seedUser();
      await seedAssistantUserBlock({ userId, source: "automatic", blockedUntil: NOW });
      await seedAssistantUserBlock({ userId: lifted.id, blockedUntil: null, liftedAt: NOW, liftedBy: "admin@example.com" });

      expect(await repository.isBlocked(userId, NOW)).toBe(false);
      expect(await repository.isBlocked(lifted.id, NOW)).toBe(false);
      expect(await repository.isBlocked(never.id, NOW)).toBe(false);
    });
  });

  describe("createAutomatic", () => {
    it("creates an automatic block with the flagged turn count", async () => {
      const { repository, userId } = await setup();

      const block = await repository.createAutomatic({ userId, blockedUntil: MIDNIGHT, flaggedTurnCount: 3 });

      expect(block).toMatchObject({
        userId,
        source: "automatic",
        blockedUntil: MIDNIGHT,
        flaggedTurnCount: 3,
        reason: null,
        liftedAt: null,
        liftedBy: null
      });
      expect(await repository.findById(block!.id)).toEqual(block);
    });

    it("creates one block when concurrent turns block the user for the same day", async () => {
      const { repository, userId, findAllOf } = await setup();

      const blocks = await Promise.all(
        Array.from({ length: 5 }, (_, index) => repository.createAutomatic({ userId, blockedUntil: MIDNIGHT, flaggedTurnCount: 3 + index }))
      );

      expect(blocks.filter(Boolean)).toHaveLength(1);
      expect(await findAllOf(userId)).toHaveLength(1);
    });

    it("keeps an admin's lift for the rest of the day and blocks again on a later day", async () => {
      const { repository, userId, findAllOf } = await setup();
      await seedAssistantUserBlock({ userId, source: "automatic", blockedUntil: MIDNIGHT, liftedAt: NOW, liftedBy: "admin@example.com" });

      expect(await repository.createAutomatic({ userId, blockedUntil: MIDNIGHT, flaggedTurnCount: 4 })).toBeUndefined();
      expect(await repository.createAutomatic({ userId, blockedUntil: new Date("2026-11-06T00:00:00.000Z"), flaggedTurnCount: 3 })).toBeDefined();
      expect(await findAllOf(userId)).toHaveLength(2);
    });

    it("blocks a user automatically next to an admin block", async () => {
      const { repository, userId } = await setup();
      await seedAssistantUserBlock({ userId, source: "admin", blockedUntil: MIDNIGHT });

      expect(await repository.createAutomatic({ userId, blockedUntil: MIDNIGHT, flaggedTurnCount: 3 })).toBeDefined();
    });
  });

  describe("findById", () => {
    it("answers nothing for a block that does not exist", async () => {
      const { repository } = await setup();

      expect(await repository.findById(faker.string.uuid())).toBeUndefined();
    });
  });

  it("deletes a user's blocks with the user", async () => {
    const { userId, findAllOf } = await setup();
    await seedAssistantUserBlock({ userId });
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const users = resolveTable("Users");

    await db.delete(users).where(eq(users.id, userId));

    expect(await findAllOf(userId)).toEqual([]);
  });

  async function setup() {
    const user = await seedUser();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("AssistantUserBlocks");
    const findAllOf = (userId: string) => db.select().from(table).where(eq(table.userId, userId));

    return { repository: container.resolve(AssistantUserBlockRepository), userId: user.id, findAllOf };
  }
});
