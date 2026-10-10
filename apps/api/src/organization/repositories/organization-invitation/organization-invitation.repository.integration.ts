import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { OrganizationInvitationRepository } from "./organization-invitation.repository";

import { seedOrganization, seedOrganizationInvitation, seedOrganizationInvitationEmail } from "@test/seeders/db/organization.seeder";
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

  describe("findPreviewByTokenHash", () => {
    it("previews the invitation with the token, its organization and its inviter", async () => {
      const { repository, organization, inviter } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: inviter.id, role: "admin", status: "accepted" });
      await seedOrganizationInvitation({ organizationId: organization.id });

      expect(await repository.findPreviewByTokenHash(invitation.tokenHash)).toEqual({
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

  describe("findByTokenHashAndLock", () => {
    it("finds the invitation with the token inside a transaction", async () => {
      const { repository, organization, txService } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      await seedOrganizationInvitation({ organizationId: organization.id });

      expect(await txService.transaction(() => repository.findByTokenHashAndLock(invitation.tokenHash))).toEqual(invitation);
    });

    it("finds nothing for an unknown token or an invitation of a deleted organization", async () => {
      const { repository, txService } = await setup();
      const deleted = await seedOrganization({ deletedAt: new Date() });
      const invitation = await seedOrganizationInvitation({ organizationId: deleted.id });

      expect(await txService.transaction(() => repository.findByTokenHashAndLock(hashInvitationToken("unknown")))).toBeUndefined();
      expect(await txService.transaction(() => repository.findByTokenHashAndLock(invitation.tokenHash))).toBeUndefined();
    });

    it("holds a concurrent lock of the same invitation until the transaction ends", async () => {
      const { repository, organization, txService } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const events: string[] = [];

      const first = txService.transaction(async () => {
        await repository.findByTokenHashAndLock(invitation.tokenHash);
        await delay(200);
        await repository.updateById(invitation.id, { status: "accepted" });
        events.push("first committed");
      });
      await delay(50);
      const second = txService.transaction(async () => {
        const locked = await repository.findByTokenHashAndLock(invitation.tokenHash);
        events.push(`second read ${locked?.status}`);
      });

      await Promise.all([first, second]);
      expect(events).toEqual(["first committed", "second read accepted"]);
    });

    it("waits for a transaction holding the organization row before locking the invitation", async () => {
      const { repository, organization, txService } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const renewedExpiry = addDays(new Date(), 30);
      const events: string[] = [];

      const first = txService.transaction(async () => {
        await container.resolve(OrganizationRepository).findOneByAndLock({ id: organization.id });
        await delay(200);
        await repository.updateById(invitation.id, { expiresAt: renewedExpiry });
        events.push("first committed");
      });
      await delay(50);
      const second = txService.transaction(async () => {
        const locked = await repository.findByTokenHashAndLock(invitation.tokenHash);
        events.push(`second read ${locked?.expiresAt.toISOString()}`);
      });

      await Promise.all([first, second]);
      expect(events).toEqual(["first committed", `second read ${renewedExpiry.toISOString()}`]);
    });

    it("leaves rows referencing the organization or the invitation writable while it holds its locks", async () => {
      const { repository, organization, inviter, txService } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const events: string[] = [];

      const holder = txService.transaction(async () => {
        await repository.findByTokenHashAndLock(invitation.tokenHash);
        await delay(300);
        events.push("locks released");
      });
      await delay(50);
      await container.resolve(UserRepository).updateById(inviter.id, { lastUsedOrganizationId: organization.id });
      await seedOrganizationInvitationEmail({ organizationId: organization.id, invitationId: invitation.id, sentByUserId: inviter.id });
      events.push("referencing rows written");
      await holder;

      expect(events).toEqual(["referencing rows written", "locks released"]);
    });

    it("refuses to lock outside a transaction", async () => {
      const { repository } = await setup();

      await expect(repository.findByTokenHashAndLock(hashInvitationToken("any"))).rejects.toThrow("An invitation can only be locked inside a transaction");
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
    const txService = container.resolve(TxService);
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

    return { repository, txService, organization, inviter, newInvitation };
  }
});
