import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { UserRepository } from "@src/user/repositories";
import { AffiliateInvitationRepository } from "./affiliate-invitation.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const SENT_AT = new Date("2026-11-23T12:00:00.000Z");

describe(AffiliateInvitationRepository.name, () => {
  describe("claim", () => {
    it("records the invitation of a person not invited yet", async () => {
      const { repository, userId } = await setup();

      await expect(repository.claim(userId, SENT_AT)).resolves.toBe(true);

      await expect(repository.findByUserId(userId)).resolves.toEqual({ userId, sentAt: SENT_AT });
    });

    it("keeps the first invitation and answers false when the person was already invited", async () => {
      const { repository, userId } = await setup();
      await repository.claim(userId, SENT_AT);

      await expect(repository.claim(userId, new Date("2026-11-24T12:00:00.000Z"))).resolves.toBe(false);

      await expect(repository.findByUserId(userId)).resolves.toEqual({ userId, sentAt: SENT_AT });
    });

    it("writes nothing when the ambient transaction rolls back", async () => {
      const { repository, userId } = await setup();

      await expect(
        container.resolve(TxService).transaction(async () => {
          await expect(repository.claim(userId, SENT_AT)).resolves.toBe(true);
          throw new Error("rolled back");
        })
      ).rejects.toThrow("rolled back");

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });
  });

  describe("release", () => {
    it("gives the claim back so the person can be claimed again", async () => {
      const { repository, userId } = await setup();
      await repository.claim(userId, SENT_AT);

      await repository.release(userId);

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
      await expect(repository.claim(userId, SENT_AT)).resolves.toBe(true);
    });

    it("keeps the invitations of other people", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser({ userId: faker.string.uuid() });
      await repository.claim(userId, SENT_AT);
      await repository.claim(other.id, SENT_AT);

      await repository.release(userId);

      await expect(repository.findByUserId(other.id)).resolves.toEqual({ userId: other.id, sentAt: SENT_AT });
    });
  });

  describe("findByUserId", () => {
    it("finds nothing for a person not invited, whoever else was", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser({ userId: faker.string.uuid() });
      await repository.claim(other.id, SENT_AT);

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });

    it("forgets the invitation of a person whose account is deleted", async () => {
      const { repository, userId } = await setup();
      await repository.claim(userId, SENT_AT);

      await container.resolve(UserRepository).deleteById(userId);

      await expect(repository.findByUserId(userId)).resolves.toBeUndefined();
    });
  });

  async function setup() {
    const user = await seedUser({ userId: faker.string.uuid() });

    return { repository: container.resolve(AffiliateInvitationRepository), userId: user.id };
  }
});
