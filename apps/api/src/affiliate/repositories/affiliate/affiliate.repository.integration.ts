import { faker } from "@faker-js/faker";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { AffiliateRepository } from "./affiliate.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AffiliateRepository.name, () => {
  describe("revokeIfActive", () => {
    it("revokes an active affiliate", async () => {
      const { repository, affiliate } = await setup();
      const revokedAt = new Date();

      const result = await repository.revokeIfActive(affiliate.id, { revokedAt, revokedBy: "ops@akash.network" });

      expect(result).toMatchObject({ id: affiliate.id, revokedAt: revokedAt.toISOString(), revokedBy: "ops@akash.network" });
    });

    it("leaves an affiliate another request already revoked untouched and returns undefined", async () => {
      const { repository, affiliate } = await setup();
      const first = await repository.revokeIfActive(affiliate.id, { revokedAt: new Date(), revokedBy: "first@akash.network" });

      const second = await repository.revokeIfActive(affiliate.id, { revokedAt: new Date(), revokedBy: "second@akash.network" });

      expect(second).toBeUndefined();
      expect(await repository.findById(affiliate.id)).toMatchObject({ revokedAt: first?.revokedAt, revokedBy: "first@akash.network" });
    });
  });

  describe("reapproveIfRevoked", () => {
    it("re-approves a revoked affiliate and clears its revocation", async () => {
      const { repository, affiliate } = await setup({ revoked: true });
      const approvedAt = new Date();

      const result = await repository.reapproveIfRevoked(affiliate.id, { code: affiliate.code, approvedAt, approvedBy: "ops@akash.network" });

      expect(result).toMatchObject({
        id: affiliate.id,
        approvedAt: approvedAt.toISOString(),
        approvedBy: "ops@akash.network",
        revokedAt: null,
        revokedBy: null
      });
    });

    it("leaves an affiliate another request already re-approved untouched and returns undefined", async () => {
      const { repository, affiliate } = await setup({ revoked: true });
      await repository.reapproveIfRevoked(affiliate.id, { code: affiliate.code, approvedAt: new Date(), approvedBy: "first@akash.network" });

      const second = await repository.reapproveIfRevoked(affiliate.id, { code: "second-code", approvedAt: new Date(), approvedBy: "second@akash.network" });

      expect(second).toBeUndefined();
      expect(await repository.findById(affiliate.id)).toMatchObject({ code: affiliate.code, approvedBy: "first@akash.network" });
    });
  });

  describe("lockById", () => {
    it("makes a second transaction locking the same affiliate wait until the first one ends", async () => {
      const { repository, txService, affiliate } = await setup();
      const steps: string[] = [];

      const first = txService.transaction(async () => {
        await repository.lockById(affiliate.id);
        steps.push("first locked");
        await delay(150);
        steps.push("first done");
      });
      await delay(50);
      const second = txService.transaction(async () => {
        await repository.lockById(affiliate.id);
        steps.push("second locked");
      });
      await Promise.all([first, second]);

      expect(steps).toEqual(["first locked", "first done", "second locked"]);
    });

    it("lets another connection record a referral to the locked affiliate", async () => {
      const { repository, txService, affiliate } = await setup();
      const referred = await seedUser();

      const referral = await txService.transaction(async () => {
        await repository.lockById(affiliate.id);
        const [row] = await container
          .resolve<ApiPgDatabase>(POSTGRES_DB)
          .insert(resolveTable("Referrals"))
          .values({ referredUserId: referred.id, affiliateId: affiliate.id })
          .returning();
        return row;
      });

      expect(referral).toMatchObject({ referredUserId: referred.id, affiliateId: affiliate.id });
    });

    it("throws outside a transaction", async () => {
      const { repository, affiliate } = await setup();

      await expect(repository.lockById(affiliate.id)).rejects.toThrow("can only be locked inside a transaction");
    });
  });

  async function setup(input: { revoked?: boolean } = {}) {
    const repository = container.resolve(AffiliateRepository);
    const user = await seedUser();
    const affiliate = await repository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 12, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network",
      ...(input.revoked && { revokedAt: new Date(), revokedBy: "ops@akash.network" })
    });

    return { repository, txService: container.resolve(TxService), affiliate };
  }
});
