import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { OrganizationInvitationEmailRepository } from "./organization-invitation-email.repository";

import { seedOrganization, seedOrganizationInvitation, seedOrganizationInvitationEmail } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

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

  async function setup() {
    const repository = container.resolve(OrganizationInvitationEmailRepository);
    const sender = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: sender.id });

    return { repository, organization, sender };
  }
});
