import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationInvitationOutput } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationInvitationEmailHandler, OrganizationInvitationEmailJob } from "./organization-invitation-email.handler";

import { seedOrganization, seedOrganizationInvitation } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const EMAIL_JOB = OrganizationInvitationEmailJob[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(OrganizationInvitationEmailHandler)]);

type SentNotification = {
  userId: string | undefined;
  body: { notificationId: string; payload: { summary: string; description: string; actions: { label: string; url: string }[] } };
};

describe(OrganizationInvitationEmailHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the invitee a link whose token is the only one the invitation accepts", async () => {
    const { invitation, organization, inviter, answerNotifications, sendEmailFor, invitationRepository } = await setup();
    const notifications = answerNotifications();

    await sendEmailFor(invitation);

    const deployWebBaseUrl = container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL");
    const [notification] = notifications;
    const url = notification.body.payload.actions[0].url;
    const token = url.replace(`${deployWebBaseUrl}/invitations#token=`, "");
    const stored = await invitationRepository.findById(invitation.id);
    expect(notifications).toEqual([
      {
        userId: emailRecipientUserId(invitation.email),
        body: {
          notificationId: expect.stringMatching(new RegExp(`^organizationInvitation\\.${invitation.id}\\.[0-9a-f-]{36}$`)),
          payload: {
            summary: `Join ${organization.name} on Akash Console`,
            description: expect.stringContaining(`${inviter.username} invited you to join`),
            actions: [{ label: "Accept invitation", url: expect.stringMatching(new RegExp(`^${deployWebBaseUrl}/invitations#token=[A-Za-z0-9_-]{43}$`)) }]
          }
        }
      }
    ]);
    expect(stored!.tokenHash).toBe(hashInvitationToken(token));
    expect(stored!.tokenHash).not.toBe(invitation.tokenHash);
  });

  it.each([
    { case: "was revoked", overrides: { status: "revoked" as const } },
    { case: "has expired", overrides: { expiresAt: addDays(new Date(), -1) } }
  ])("completes without emailing anyone when the invitation $case", async ({ overrides }) => {
    const { organization, answerNotifications, sendEmailFor, invitationRepository } = await setup();
    const invitation = await seedOrganizationInvitation({ organizationId: organization.id, ...overrides });
    const notifications = answerNotifications();

    await sendEmailFor(invitation);

    expect(notifications).toEqual([]);
    expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
  });

  it("completes without emailing anyone when a newer token replaced the one the email was meant for", async () => {
    const { invitation, answerNotifications, sendEmailFor, invitationRepository } = await setup();
    const notifications = answerNotifications();
    const newerTokenHash = hashInvitationToken("newer");
    await invitationRepository.updateById(invitation.id, { tokenHash: newerTokenHash });

    await sendEmailFor(invitation);

    expect(notifications).toEqual([]);
    expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: newerTokenHash });
  });

  it("keeps the invitation's token when the email fails, so a retry can still send it", async () => {
    const { invitation, notificationsBaseUrl, answerNotifications, startSending, invitationRepository } = await setup();
    nock(notificationsBaseUrl).persist().post(NOTIFICATION_PATH).reply(500);

    await startSending(invitation);
    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(EMAIL_JOB, { data: { invitationId: invitation.id } });
        expect(row.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );

    expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });

    nock.cleanAll();
    const notifications = answerNotifications();
    await makeJobDue(EMAIL_JOB, { data: { invitationId: invitation.id } });
    await expectJobCompleted(EMAIL_JOB, { data: { invitationId: invitation.id } });

    expect(notifications).toHaveLength(1);
    expect(await invitationRepository.findById(invitation.id)).not.toMatchObject({ tokenHash: invitation.tokenHash });
  });

  it("completes without emailing anyone when the invitation no longer exists", async () => {
    const { answerNotifications, sendEmailFor } = await setup();
    const notifications = answerNotifications();

    await sendEmailFor({ id: faker.string.uuid(), tokenHash: hashInvitationToken("gone") });

    expect(notifications).toEqual([]);
  });

  it("completes without emailing anyone when the organization was deleted", async () => {
    const { answerNotifications, sendEmailFor, invitationRepository } = await setup();
    const deleted = await seedOrganization({ deletedAt: new Date() });
    const invitation = await seedOrganizationInvitation({ organizationId: deleted.id });
    const notifications = answerNotifications();

    await sendEmailFor(invitation);

    expect(notifications).toEqual([]);
    expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
  });

  it("does not name an inviter without an account", async () => {
    const { organization, answerNotifications, sendEmailFor } = await setup();
    const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: null });
    const notifications = answerNotifications();

    await sendEmailFor(invitation);

    expect(notifications).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ payload: expect.objectContaining({ description: expect.stringMatching(/^<p>You have been invited to join /) }) })
      })
    ]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const invitationRepository = container.resolve(OrganizationInvitationRepository);
    const inviter = await seedUser({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` });
    const organization = await seedOrganization({ createdByUserId: inviter.id });
    const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: inviter.id, role: "admin" });

    function answerNotifications() {
      const sent: SentNotification[] = [];
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          sent.push({ userId: this.req.headers["x-user-id"] as string | undefined, body: body as SentNotification["body"] });
          return [204];
        });

      return sent;
    }

    async function startSending({ id, tokenHash }: Pick<OrganizationInvitationOutput, "id" | "tokenHash">) {
      await enqueue(new OrganizationInvitationEmailJob({ invitationId: id, tokenHash }));
      await startWorkers();
    }

    async function sendEmailFor(invitation: Pick<OrganizationInvitationOutput, "id" | "tokenHash">) {
      await startSending(invitation);
      await expectJobCompleted(EMAIL_JOB, { data: { invitationId: invitation.id } });
    }

    return { invitation, organization, inviter, invitationRepository, notificationsBaseUrl, answerNotifications, startSending, sendEmailFor };
  }
});
