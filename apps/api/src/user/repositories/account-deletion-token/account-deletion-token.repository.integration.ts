import { faker } from "@faker-js/faker";
import { addMinutes, subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { AccountDeletionTokenRepository } from "./account-deletion-token.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AccountDeletionTokenRepository.name, () => {
  describe("replaceForUser", () => {
    it("keeps a single link per user, so issuing a new one invalidates the previous one", async () => {
      const { repository, userId, hash } = await setup();
      const first = hash();
      const second = hash();

      await repository.replaceForUser({ userId, tokenHash: first, acknowledgedForfeitUsd: 0, expiresAt: addMinutes(new Date(), 15) });
      await repository.replaceForUser({ userId, tokenHash: second, acknowledgedForfeitUsd: 12.5, expiresAt: addMinutes(new Date(), 15) });

      expect(await repository.findByTokenHash(first)).toBeUndefined();
      expect(await repository.findByTokenHash(second)).toMatchObject({ userId, acknowledgedForfeitUsd: 12.5 });
    });

    it("restarts the link's age when it replaces one", async () => {
      const { repository, db, userId, hash } = await setup();
      const table = resolveTable("AccountDeletionTokens");
      await repository.replaceForUser({ userId, tokenHash: hash(), acknowledgedForfeitUsd: 0, expiresAt: addMinutes(new Date(), 15) });
      await db
        .update(table)
        .set({ createdAt: subMinutes(new Date(), 30) })
        .where(eq(table.userId, userId));

      await repository.replaceForUser({ userId, tokenHash: hash(), acknowledgedForfeitUsd: 0, expiresAt: addMinutes(new Date(), 15) });

      const token = await repository.findByUserId(userId);
      expect(token!.createdAt.getTime()).toBeGreaterThan(subMinutes(new Date(), 1).getTime());
    });
  });

  describe("deleteByUserId", () => {
    it("removes the user's link", async () => {
      const { repository, userId, hash } = await setup();
      await repository.replaceForUser({ userId, tokenHash: hash(), acknowledgedForfeitUsd: 0, expiresAt: addMinutes(new Date(), 15) });

      await repository.deleteByUserId(userId);

      expect(await repository.findByUserId(userId)).toBeUndefined();
    });
  });

  async function setup() {
    const user = await seedUser({ userId: faker.string.uuid() });

    return {
      repository: container.resolve(AccountDeletionTokenRepository),
      db: container.resolve<ApiPgDatabase>(POSTGRES_DB),
      userId: user.id,
      hash: () => faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" })
    };
  }
});
