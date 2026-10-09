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

  describe("findActiveMembership", () => {
    it("finds the user's membership by organization id, by slug and as their personal organization", async () => {
      const { repository, user, organization } = await setup();
      const member = await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role: "viewer" });
      const personal = await seedOrganization({ type: "personal", createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: personal.id, userId: user.id, role: "owner" });

      expect(await repository.findActiveMembership(user.id, { id: organization.id })).toEqual({ role: member.role, organization });
      expect(await repository.findActiveMembership(user.id, { slug: organization.slug })).toEqual({ role: member.role, organization });
      expect(await repository.findActiveMembership(user.id, { type: "personal" })).toEqual({ role: "owner", organization: personal });
    });

    it("finds nothing in an organization the user does not belong to", async () => {
      const { repository, user } = await setup();
      const { organization } = await seedOrganizationWithOwner();

      expect(await repository.findActiveMembership(user.id, { id: organization.id })).toBeUndefined();
      expect(await repository.findActiveMembership(user.id, { slug: organization.slug })).toBeUndefined();
    });

    it("finds nothing in a deleted organization", async () => {
      const { repository, user } = await setup();
      const deleted = await seedOrganization({ createdByUserId: user.id, deletedAt: new Date() });
      await seedOrganizationMember({ organizationId: deleted.id, userId: user.id, role: "owner" });

      expect(await repository.findActiveMembership(user.id, { id: deleted.id })).toBeUndefined();
    });

    it("finds no personal organization the user is only a member of", async () => {
      const { repository, user } = await setup();
      const { organization: othersPersonal } = await seedOrganizationWithOwner({ type: "personal" });
      await seedOrganizationMember({ organizationId: othersPersonal.id, userId: user.id });

      expect(await repository.findActiveMembership(user.id, { type: "personal" })).toBeUndefined();
    });
  });

  describe("findActiveMemberships", () => {
    it("lists the user's live organizations, personal first then oldest first", async () => {
      const { repository, user, organization } = await setup();
      await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role: "admin" });
      const newer = await seedOrganization({ createdAt: new Date(organization.createdAt.getTime() + 1000) });
      await seedOrganizationMember({ organizationId: newer.id, userId: user.id, role: "billing" });
      const personal = await seedOrganization({ type: "personal", createdByUserId: user.id, createdAt: new Date(organization.createdAt.getTime() + 2000) });
      await seedOrganizationMember({ organizationId: personal.id, userId: user.id, role: "owner" });
      const deleted = await seedOrganization({ deletedAt: new Date() });
      await seedOrganizationMember({ organizationId: deleted.id, userId: user.id });
      await seedOrganizationWithOwner();

      expect(await repository.findActiveMemberships(user.id)).toEqual([
        { role: "owner", organization: personal },
        { role: "admin", organization },
        { role: "billing", organization: newer }
      ]);
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
