import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationMemberRepository } from "./organization-member.repository";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(OrganizationMemberRepository.name, () => {
  describe("createUnlessExists", () => {
    it("adds the member once and keeps the role they were first given", async () => {
      const { repository, organization, user } = await setup();

      const created = await repository.createUnlessExists({ organizationId: organization.id, userId: user.id, role: "owner" });
      const repeated = await repository.createUnlessExists({ organizationId: organization.id, userId: user.id, role: "member" });

      expect(created).toMatchObject({ organizationId: organization.id, userId: user.id, role: "owner" });
      expect(repeated).toBeUndefined();
      expect(await repository.find({ organizationId: organization.id, userId: user.id })).toEqual([created]);
    });
  });

  describe("lockOwners", () => {
    it("returns the owners of the organization and nobody else", async () => {
      const { repository, txService, organization, user } = await setup();
      const owner = await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role: "owner" });
      const admin = await seedUser();
      await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" });
      await seedOrganizationWithOwner();

      const owners = await txService.transaction(() => repository.lockOwners(organization.id));

      expect(owners).toEqual([owner]);
    });

    it("refuses to lock outside a transaction", async () => {
      const { repository, organization } = await setup();

      await expect(repository.lockOwners(organization.id)).rejects.toThrow(/inside a transaction/);
    });
  });

  async function setup() {
    const repository = container.resolve(OrganizationMemberRepository);
    const txService = container.resolve(TxService);
    const user = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: user.id });

    return { repository, txService, user, organization };
  }
});
