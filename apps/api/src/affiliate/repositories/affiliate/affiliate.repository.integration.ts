import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

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

    return { repository, affiliate };
  }
});
