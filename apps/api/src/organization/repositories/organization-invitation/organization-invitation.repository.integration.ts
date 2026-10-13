import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import { OrganizationInvitationRepository } from "./organization-invitation.repository";

import { seedOrganization, seedOrganizationInvitation } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(OrganizationInvitationRepository.name, () => {
  describe("createUnlessPending", () => {
    it("creates one pending invitation per address and organization", async () => {
      const { repository, organization, newInvitation } = await setup();
      const other = await seedOrganization();

      const created = await repository.createUnlessPending([newInvitation({ email: "jane@example.com" }), newInvitation({ email: "joe@example.com" })]);
      const repeated = await repository.createUnlessPending([newInvitation({ email: "jane@example.com" })]);
      const elsewhere = await repository.createUnlessPending([newInvitation({ email: "jane@example.com", organizationId: other.id })]);

      expect(created.map(invitation => invitation.email).sort()).toEqual(["jane@example.com", "joe@example.com"]);
      expect(created).toEqual(expect.arrayContaining([expect.objectContaining({ organizationId: organization.id, status: "pending" })]));
      expect(repeated).toEqual([]);
      expect(elsewhere).toEqual([expect.objectContaining({ organizationId: other.id, email: "jane@example.com" })]);
      expect(await repository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(1);
    });

    it("invites an address again once its previous invitation is no longer pending", async () => {
      const { repository, organization, newInvitation } = await setup();
      await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com", status: "revoked" });
      await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com", status: "accepted" });

      const created = await repository.createUnlessPending([newInvitation({ email: "jane@example.com" })]);

      expect(created).toHaveLength(1);
      expect(await repository.count({ organizationId: organization.id, email: "jane@example.com", status: "pending" })).toBe(1);
    });

    it("keeps one pending invitation when the same address is invited concurrently", async () => {
      const { repository, organization, newInvitation } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => repository.createUnlessPending([newInvitation({ email: "jane@example.com" })])));

      expect(results.flat()).toHaveLength(1);
      expect(await repository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(1);
    });

    it("creates nothing without an address", async () => {
      const { repository } = await setup();

      expect(await repository.createUnlessPending([])).toEqual([]);
    });
  });

  describe("countPending", () => {
    it("counts the pending invitations of the organization, expired ones included", async () => {
      const { repository, organization } = await setup();
      await seedOrganizationInvitation({ organizationId: organization.id });
      await seedOrganizationInvitation({ organizationId: organization.id, expiresAt: addDays(new Date(), -1) });
      await seedOrganizationInvitation({ organizationId: organization.id, status: "revoked" });
      await seedOrganizationInvitation({ organizationId: (await seedOrganization()).id });

      expect(await repository.countPending(organization.id)).toBe(2);
    });
  });

  describe("findPendingWithInviters", () => {
    it("lists the pending invitations of the organization with their inviter, oldest first", async () => {
      const { repository, organization, inviter } = await setup();
      const first = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: inviter.id, createdAt: addDays(new Date(), -2) });
      const second = await seedOrganizationInvitation({
        organizationId: organization.id,
        invitedByUserId: null,
        projectGrants: [{ projectId: faker.string.uuid(), role: "viewer" }],
        createdAt: addDays(new Date(), -1)
      });
      await seedOrganizationInvitation({ organizationId: organization.id, status: "revoked" });
      await seedOrganizationInvitation({ organizationId: (await seedOrganization()).id });

      const invitations = await repository.findPendingWithInviters(organization.id);

      expect(invitations).toEqual([
        {
          id: first.id,
          organizationId: organization.id,
          email: first.email,
          role: first.role,
          projectGrants: [],
          createdAt: first.createdAt,
          expiresAt: first.expiresAt,
          invitedBy: { id: inviter.id, username: inviter.username }
        },
        {
          id: second.id,
          organizationId: organization.id,
          email: second.email,
          role: second.role,
          projectGrants: second.projectGrants,
          createdAt: second.createdAt,
          expiresAt: second.expiresAt,
          invitedBy: null
        }
      ]);
    });

    it("narrows the list to the given ids or addresses", async () => {
      const { repository, organization } = await setup();
      const jane = await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com" });
      const joe = await seedOrganizationInvitation({ organizationId: organization.id, email: "joe@example.com" });

      expect((await repository.findPendingWithInviters(organization.id, { ids: [jane.id] })).map(invitation => invitation.id)).toEqual([jane.id]);
      expect((await repository.findPendingWithInviters(organization.id, { emails: ["joe@example.com"] })).map(invitation => invitation.id)).toEqual([joe.id]);
    });
  });

  describe("replaceTokenHash", () => {
    it("replaces the token of a pending invitation that still carries the expected one", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const tokenHash = hashInvitationToken("next");

      const replaced = await repository.replaceTokenHash(invitation.id, { from: invitation.tokenHash, to: tokenHash });

      expect(replaced).toMatchObject({ id: invitation.id, tokenHash });
      expect(await repository.findById(invitation.id)).toMatchObject({ tokenHash });
    });

    it("leaves an invitation alone once another token replaced the expected one", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });

      const replaced = await repository.replaceTokenHash(invitation.id, { from: hashInvitationToken("stale"), to: hashInvitationToken("next") });

      expect(replaced).toBeUndefined();
      expect(await repository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });

    it("leaves an invitation alone once it is no longer pending", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, status: "revoked" });

      const replaced = await repository.replaceTokenHash(invitation.id, { from: invitation.tokenHash, to: hashInvitationToken("next") });

      expect(replaced).toBeUndefined();
      expect(await repository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });
  });

  async function setup() {
    const repository = container.resolve(OrganizationInvitationRepository);
    const inviter = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: inviter.id });

    function newInvitation(overrides: { email: string; organizationId?: string }) {
      return {
        organizationId: organization.id,
        role: "member" as const,
        projectGrants: [],
        tokenHash: hashInvitationToken(faker.string.alphanumeric(43)),
        expiresAt: addDays(new Date(), 7),
        invitedByUserId: inviter.id,
        ...overrides
      };
    }

    return { repository, organization, inviter, newInvitation };
  }
});
