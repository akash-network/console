import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusWinBackRepository } from "./first-purchase-bonus-win-back.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const OPENED_AT = new Date("2026-10-19T12:00:00.000Z");
const CLOSES_AT = new Date("2026-10-26T12:00:00.000Z");

describe(FirstPurchaseBonusWinBackRepository.name, () => {
  describe("create", () => {
    it("records a window that closes", async () => {
      const { repository, userId } = await setup();

      await expect(repository.create({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT })).resolves.toBe(true);

      await expect(repository.findByUserId(userId)).resolves.toEqual({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT });
    });

    it("records a window with no deadline", async () => {
      const { repository, userId } = await setup();

      await repository.create({ userId, openedAt: OPENED_AT, closesAt: null });

      await expect(repository.findByUserId(userId)).resolves.toEqual({ userId, openedAt: OPENED_AT, closesAt: null });
    });

    it("keeps the first window and answers false when the person already has one", async () => {
      const { repository, userId } = await setup();
      await repository.create({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT });

      await expect(repository.create({ userId, openedAt: CLOSES_AT, closesAt: null })).resolves.toBe(false);

      await expect(repository.findByUserId(userId)).resolves.toEqual({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT });
    });

    it("writes nothing when the ambient transaction rolls back", async () => {
      const { repository, userId } = await setup();

      await expect(
        container.resolve(TxService).transaction(async () => {
          await repository.create({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT });
          throw new Error("rolled back");
        })
      ).rejects.toThrow("rolled back");

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });
  });

  describe("findByUserId", () => {
    it("finds nothing for a person without a window, whoever else has one", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser({ userId: faker.string.uuid() });
      await repository.create({ userId: other.id, openedAt: OPENED_AT, closesAt: CLOSES_AT });

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });

    it("forgets the window of a person whose account is deleted", async () => {
      const { repository, userId } = await setup();
      await repository.create({ userId, openedAt: OPENED_AT, closesAt: CLOSES_AT });

      await container.resolve(UserRepository).deleteById(userId);

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });
  });

  async function setup() {
    const user = await seedUser({ userId: faker.string.uuid() });

    return { repository: container.resolve(FirstPurchaseBonusWinBackRepository), userId: user.id };
  }
});
