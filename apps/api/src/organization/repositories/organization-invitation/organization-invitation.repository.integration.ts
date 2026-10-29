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

    it("limits an invitation created without a project access to its project grants", async () => {
      const { repository, newInvitation } = await setup();

      const [created] = await repository.createUnlessPending([newInvitation({ email: "jane@example.com" })]);

      expect(created).toMatchObject({ role: "member", projectAccess: "selected" });
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
          projectAccess: first.projectAccess,
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
          projectAccess: second.projectAccess,
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

  describe("findPreviewByTokenHash", () => {
    it("previews the invitation with the token, its organization and its inviter", async () => {
      const { repository, organization, inviter } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: inviter.id, role: "admin", status: "accepted" });
      await seedOrganizationInvitation({ organizationId: organization.id });

      expect(await repository.findPreviewByTokenHash(invitation.tokenHash)).toEqual({
        organizationId: organization.id,
        organizationName: organization.name,
        inviterName: inviter.username,
        role: "admin",
        email: invitation.email,
        status: "accepted",
        expiresAt: invitation.expiresAt
      });
    });

    it("previews an invitation whose inviter is gone without an inviter name", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: null });

      expect(await repository.findPreviewByTokenHash(invitation.tokenHash)).toMatchObject({ organizationName: organization.name, inviterName: null });
    });

    it("finds nothing for an unknown token or an invitation of a deleted organization", async () => {
      const { repository } = await setup();
      const deleted = await seedOrganization({ deletedAt: new Date() });
      const invitation = await seedOrganizationInvitation({ organizationId: deleted.id });

      expect(await repository.findPreviewByTokenHash(hashInvitationToken("unknown"))).toBeUndefined();
      expect(await repository.findPreviewByTokenHash(invitation.tokenHash)).toBeUndefined();
    });
  });

  describe("findPendingSentTo", () => {
    it("lists the open invitations sent to the address across organizations, newest first, with their organization and inviter", async () => {
      const { repository, organization, inviter } = await setup();
      const email = `jane-${faker.string.alphanumeric(12).toLowerCase()}@example.com`;
      const otherTeam = await seedOrganization({ name: `other-${faker.string.alphanumeric(8)}` });
      const older = await seedOrganizationInvitation({
        organizationId: organization.id,
        email,
        role: "admin",
        invitedByUserId: inviter.id,
        createdAt: addDays(new Date(), -2)
      });
      const newer = await seedOrganizationInvitation({
        organizationId: otherTeam.id,
        email,
        role: "viewer",
        invitedByUserId: null,
        createdAt: addDays(new Date(), -1)
      });

      const invitations = await repository.findPendingSentTo(email);

      expect(invitations).toEqual([
        {
          id: newer.id,
          organizationId: otherTeam.id,
          organizationName: otherTeam.name,
          inviterName: null,
          role: "viewer",
          createdAt: newer.createdAt,
          expiresAt: newer.expiresAt
        },
        {
          id: older.id,
          organizationId: organization.id,
          organizationName: organization.name,
          inviterName: inviter.username,
          role: "admin",
          createdAt: older.createdAt,
          expiresAt: older.expiresAt
        }
      ]);
    });

    it("leaves out invitations that are answered, revoked, expired, of a deleted organization or sent to another address", async () => {
      const { repository, organization } = await setup();
      const email = `jane-${faker.string.alphanumeric(12).toLowerCase()}@example.com`;
      const deleted = await seedOrganization({ deletedAt: new Date() });
      await seedOrganizationInvitation({ organizationId: organization.id, email, status: "accepted" });
      await seedOrganizationInvitation({ organizationId: organization.id, email, status: "revoked" });
      await seedOrganizationInvitation({ organizationId: organization.id, email, status: "declined" });
      await seedOrganizationInvitation({ organizationId: organization.id, email, expiresAt: addDays(new Date(), -1) });
      await seedOrganizationInvitation({ organizationId: deleted.id, email });
      await seedOrganizationInvitation({ organizationId: organization.id, email: `joe-${email}` });

      expect(await repository.findPendingSentTo(email)).toEqual([]);
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
    const inviter = await seedUser({ userId: faker.string.uuid(), username: `inviter-${faker.string.alphanumeric(12)}` });
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
