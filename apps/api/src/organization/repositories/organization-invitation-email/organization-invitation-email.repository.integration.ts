import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationInvitationEmailRepository } from "./organization-invitation-email.repository";

import { seedOrganization, seedOrganizationInvitation, seedOrganizationInvitationEmail } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(OrganizationInvitationEmailRepository.name, () => {
  describe("recordSends", () => {
    it("records one send per invitation", async () => {
      const { repository, organization, sender } = await setup();
      const jane = await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com" });
      const joe = await seedOrganizationInvitation({ organizationId: organization.id, email: "joe@example.com" });

      await repository.recordSends([
        { organizationId: organization.id, invitationId: jane.id, sentByUserId: sender.id },
        { organizationId: organization.id, invitationId: joe.id, sentByUserId: sender.id }
      ]);

      expect(await repository.find({ organizationId: organization.id })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ invitationId: jane.id, sentByUserId: sender.id }),
          expect.objectContaining({ invitationId: joe.id, sentByUserId: sender.id })
        ])
      );
      expect(await repository.count({ organizationId: organization.id })).toBe(2);
    });

    it("records nothing without an invitation", async () => {
      const { repository, organization } = await setup();

      await repository.recordSends([]);

      expect(await repository.count({ organizationId: organization.id })).toBe(0);
    });
  });

  describe("findSendsSince", () => {
    it("lists the organization's sends since the given time with their address, oldest first, whoever sent them", async () => {
      const { repository, organization, sender } = await setup();
      const colleague = await seedUser({ userId: faker.string.uuid() });
      const jane = await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com", status: "revoked" });
      const joe = await seedOrganizationInvitation({ organizationId: organization.id, email: "joe@example.com" });
      const older = await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: jane.id,
        sentByUserId: sender.id,
        createdAt: subHours(new Date(), 2)
      });
      const newer = await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: joe.id,
        sentByUserId: colleague.id,
        createdAt: subHours(new Date(), 1)
      });
      await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: joe.id,
        sentByUserId: sender.id,
        createdAt: subHours(new Date(), 30)
      });
      const other = await seedOrganization();
      await seedOrganizationInvitationEmail({
        organizationId: other.id,
        invitationId: (await seedOrganizationInvitation({ organizationId: other.id })).id,
        sentByUserId: sender.id
      });

      const sends = await repository.findSendsSince({ organizationId: organization.id }, subHours(new Date(), 24));

      expect(sends).toEqual([
        { email: "jane@example.com", createdAt: older.createdAt },
        { email: "joe@example.com", createdAt: newer.createdAt }
      ]);
    });

    it("lists a sender's sends in every organization", async () => {
      const { repository, organization, sender } = await setup();
      const other = await seedOrganization();
      const here = await seedOrganizationInvitation({ organizationId: organization.id, email: "jane@example.com" });
      const there = await seedOrganizationInvitation({ organizationId: other.id, email: "joe@example.com" });
      await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: here.id,
        sentByUserId: sender.id,
        createdAt: subHours(new Date(), 2)
      });
      await seedOrganizationInvitationEmail({ organizationId: other.id, invitationId: there.id, sentByUserId: sender.id, createdAt: subHours(new Date(), 1) });
      await seedOrganizationInvitationEmail({ organizationId: other.id, invitationId: there.id, sentByUserId: null });

      const sends = await repository.findSendsSince({ sentByUserId: sender.id }, subHours(new Date(), 24));

      expect(sends.map(send => send.email)).toEqual(["jane@example.com", "joe@example.com"]);
    });
  });

  describe("deleteSentBefore", () => {
    it("deletes only the organization's sends recorded before the given time, whatever became of their invitation", async () => {
      const { repository, organization, sender } = await setup();
      const accepted = await seedOrganizationInvitation({ organizationId: organization.id, status: "accepted" });
      const revoked = await seedOrganizationInvitation({ organizationId: organization.id, status: "revoked" });
      const sentBefore = subHours(new Date(), 25);
      await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: accepted.id,
        sentByUserId: sender.id,
        createdAt: subHours(sentBefore, 1)
      });
      await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: revoked.id,
        sentByUserId: null,
        createdAt: subHours(sentBefore, 48)
      });
      const kept = await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: revoked.id,
        sentByUserId: sender.id,
        createdAt: sentBefore
      });
      const other = await seedOrganization();
      const otherInvitation = await seedOrganizationInvitation({ organizationId: other.id });
      const otherSend = await seedOrganizationInvitationEmail({
        organizationId: other.id,
        invitationId: otherInvitation.id,
        sentByUserId: sender.id,
        createdAt: subHours(sentBefore, 1)
      });

      const deletedCount = await repository.deleteSentBefore(organization.id, sentBefore);

      expect(deletedCount).toBe(2);
      expect(await repository.find({ organizationId: organization.id })).toEqual([expect.objectContaining({ id: kept.id })]);
      expect(await repository.find({ organizationId: other.id })).toEqual([expect.objectContaining({ id: otherSend.id })]);
    });

    it("keeps to the active organization unless unscoped for retention", async () => {
      const { repository, organization, sender, runInOrganization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const sentBefore = subHours(new Date(), 25);
      await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: invitation.id,
        sentByUserId: sender.id,
        createdAt: subHours(sentBefore, 1)
      });
      const active = await seedOrganization();

      const scopedCount = await runInOrganization(active.id, () => repository.deleteSentBefore(organization.id, sentBefore));
      const unscopedCount = await runInOrganization(active.id, () =>
        repository.unscoped("invitation-email-retention").deleteSentBefore(organization.id, sentBefore)
      );

      expect(scopedCount).toBe(0);
      expect(unscopedCount).toBe(1);
    });

    it("deletes nothing from an organization without sends that old", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      await seedOrganizationInvitationEmail({ organizationId: organization.id, invitationId: invitation.id });

      const deletedCount = await repository.deleteSentBefore(organization.id, subHours(new Date(), 25));

      expect(deletedCount).toBe(0);
      expect(await repository.count({ organizationId: organization.id })).toBe(1);
    });
  });

  describe("findOldestSentAt", () => {
    it("finds when the organization recorded its oldest send", async () => {
      const { repository, organization } = await setup();
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      await seedOrganizationInvitationEmail({ organizationId: organization.id, invitationId: invitation.id, createdAt: subHours(new Date(), 1) });
      const oldest = await seedOrganizationInvitationEmail({
        organizationId: organization.id,
        invitationId: invitation.id,
        createdAt: subHours(new Date(), 5)
      });
      const other = await seedOrganization();
      await seedOrganizationInvitationEmail({
        organizationId: other.id,
        invitationId: (await seedOrganizationInvitation({ organizationId: other.id })).id,
        createdAt: subHours(new Date(), 10)
      });

      expect(await repository.findOldestSentAt(organization.id)).toEqual(oldest.createdAt);
    });

    it("finds nothing for an organization without sends", async () => {
      const { repository, organization } = await setup();

      expect(await repository.findOldestSentAt(organization.id)).toBeUndefined();
    });
  });

  async function setup() {
    const repository = container.resolve(OrganizationInvitationEmailRepository);
    const sender = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: sender.id });
    const executionContextService = container.resolve(ExecutionContextService);

    async function runInOrganization<R>(organizationId: string, run: () => Promise<R>) {
      return await executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId }));

        return await run();
      });
    }

    return { repository, organization, sender, runInOrganization };
  }
});
