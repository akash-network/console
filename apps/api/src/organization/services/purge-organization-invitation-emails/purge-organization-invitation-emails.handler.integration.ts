import { addHours, subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { OrganizationInvitationEmailRepository } from "@src/organization/repositories/organization-invitation-email/organization-invitation-email.repository";
import { INVITATION_EMAIL_RETENTION_HOURS, InvitationEmailLimiter } from "@src/organization/services/invitation-email-limiter/invitation-email-limiter.service";
import { PurgeOrganizationInvitationEmailsHandler } from "./purge-organization-invitation-emails.handler";
import { PurgeOrganizationInvitationEmailsJob, purgeOrganizationInvitationEmailsKeyFor } from "./purge-organization-invitation-emails.job";

import { seedOrganizationInvitation, seedOrganizationInvitationEmail, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const PURGE_JOB = PurgeOrganizationInvitationEmailsJob[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(PurgeOrganizationInvitationEmailsHandler)]);

describe(PurgeOrganizationInvitationEmailsHandler.name, () => {
  it("purges the organization's sends past retention and queues the next purge for the oldest one kept, run the way a worker runs it", async () => {
    const { organization, seedSend, purge, sendsOf, waitingPurgesOf } = await setup();
    await seedSend(organization.id, subHours(new Date(), INVITATION_EMAIL_RETENTION_HOURS + 1));
    const kept = await seedSend(organization.id, subHours(new Date(), 2));
    const { organization: other } = await seedOrganizationWithOwner();
    const otherSend = await seedSend(other.id, subHours(new Date(), INVITATION_EMAIL_RETENTION_HOURS + 1));

    await purge(organization.id);

    expect(await sendsOf(organization.id)).toEqual([kept.id]);
    expect(await sendsOf(other.id)).toEqual([otherSend.id]);
    expect((await waitingPurgesOf(organization.id)).map(job => new Date(job.start_after).getTime())).toEqual([
      addHours(kept.createdAt, INVITATION_EMAIL_RETENTION_HOURS).getTime()
    ]);
  });

  it("queues no other purge once the organization has no send left", async () => {
    const { organization, seedSend, purge, sendsOf, waitingPurgesOf } = await setup();
    await seedSend(organization.id, subHours(new Date(), INVITATION_EMAIL_RETENTION_HOURS + 1));

    await purge(organization.id);

    expect(await sendsOf(organization.id)).toEqual([]);
    expect(await waitingPurgesOf(organization.id)).toEqual([]);
  });

  it("keeps a single waiting purge per organization however many sends are recorded", async () => {
    const { organization, owner, waitingPurgesOf } = await setup();
    const limiter = container.resolve(InvitationEmailLimiter);
    const invitations = await Promise.all([1, 2].map(() => seedOrganizationInvitation({ organizationId: organization.id })));

    for (const invitation of invitations) {
      await limiter.recordSends([invitation], owner.id);
    }

    expect(await waitingPurgesOf(organization.id)).toHaveLength(1);
  });

  async function setup() {
    const { organization, user: owner } = await seedOrganizationWithOwner();
    const emailRepository = container.resolve(OrganizationInvitationEmailRepository);
    const { enqueue, startWorkers } = await jobWorkers();

    async function seedSend(organizationId: string, createdAt: Date) {
      const invitation = await seedOrganizationInvitation({ organizationId });

      return await seedOrganizationInvitationEmail({ organizationId, invitationId: invitation.id, createdAt });
    }

    async function purge(organizationId: string) {
      const singletonKey = purgeOrganizationInvitationEmailsKeyFor(organizationId);
      await enqueue(new PurgeOrganizationInvitationEmailsJob({ organizationId }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(PURGE_JOB, { singletonKey, state: "completed" });
    }

    async function sendsOf(organizationId: string) {
      return (await emailRepository.find({ organizationId })).map(send => send.id);
    }

    async function waitingPurgesOf(organizationId: string) {
      return await findJobRows(PURGE_JOB, { singletonKey: purgeOrganizationInvitationEmailsKeyFor(organizationId), state: "created" });
    }

    return { organization, owner, seedSend, purge, sendsOf, waitingPurgesOf };
  }
});
