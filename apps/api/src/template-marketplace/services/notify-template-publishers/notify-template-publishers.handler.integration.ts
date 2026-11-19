import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PurgeExpiredActivitiesHandler } from "@src/activity/services/purge-expired-activities/purge-expired-activities.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { NotifyTemplatePublishersHandler } from "./notify-template-publishers.handler";
import {
  NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS,
  NotifyTemplatePublishers,
  notifyTemplatePublishersKeyFor,
  type TemplatePublisherNoticeSource
} from "./notify-template-publishers.job";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplateModerationEvent, seedTemplateVersion } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const JOB = NotifyTemplatePublishers[JOB_NAME];
const SUPPORT = '<p>If you think this is a mistake or have questions, email <a href="mailto:support@akash.network">support@akash.network</a>.</p>';

const FAILED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T00:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "no_secrets", status: "failed", issues: [{ message: "POSTGRES_PASSWORD is set in plain text." }] }
  ]
};

type SentNotification = {
  userId: string | undefined;
  recipient: string;
  notificationId: string;
  payload: { summary: string; description: string; actions?: { label: string; url: string }[] };
};

const jobWorkers = useJobWorkers(() => [container.resolve(NotifyTemplatePublishersHandler), container.resolve(PurgeExpiredActivitiesHandler)]);

describe(NotifyTemplatePublishersHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("tells the owners, the admins and the version's author of a staff action, in the app and by email, run the way a worker runs it", async () => {
    const { organization, owner, addMember, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const admin = await addMember("admin");
    const author = await addMember("member");
    const bystander = await addMember("member");
    const viewer = await addMember("viewer");
    const { template, version } = await seedPublicTemplate({ title: "Postgres 16", createdById: author.id, version: 4 });
    const event = await seedTemplateModerationEvent({
      templateId: template.id,
      templateVersionId: version.id,
      action: "reject_version",
      reason: "It <b>mines</b>."
    });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    const templateUrl = `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/template/${template.id}`;
    const description =
      "<p>Akash staff reviewed version 4 of <strong>Postgres 16</strong> and did not approve it. The current version stays the one people deploy.</p>" +
      `<p><strong>Reason:</strong> It &lt;b&gt;mines&lt;/b&gt;.</p>${SUPPORT}`;
    expect(notifications.sent).toEqual(
      [owner, admin, author].map(recipient => ({
        userId: recipient.id,
        recipient: recipient.email,
        notificationId: `templateVersionRejected.${event.id}.${recipient.id}`,
        payload: { summary: 'Version 4 of "Postgres 16" was not approved', description, actions: [{ label: "Open template", url: templateUrl }] }
      }))
    );
    for (const recipient of [owner, admin, author]) {
      expect(await activitiesOf(recipient)).toMatchObject([
        {
          organizationId: organization.id,
          type: "template_update",
          status: "info",
          initiator: "system",
          meta: { summary: 'Version 4 of "Postgres 16" was not approved', templateId: template.id },
          dedupeKey: `templateNotice:version_rejected:${event.id}`
        }
      ]);
    }
    expect(await activitiesOf(bystander)).toEqual([]);
    expect(await activitiesOf(viewer)).toEqual([]);
  });

  it("tells whoever saved the current version of a staff action that names no version", async () => {
    const { owner, addMember, seedPublicTemplate, answerNotifications, notify } = await setup();
    const earlierAuthor = await addMember("member");
    const currentAuthor = await addMember("member");
    const { template } = await seedPublicTemplate({ title: "Postgres 16", createdById: earlierAuthor.id, version: 1 });
    await seedTemplateVersion({ templateId: template.id, version: 2, createdById: currentAuthor.id });
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "hide" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id, currentAuthor.id]);
    expect(notifications.sent[0].payload.summary).toBe('"Postgres 16" was hidden');
  });

  it("tells one member once who is both an admin and the version's author", async () => {
    const { owner, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const { template } = await seedPublicTemplate({ createdById: owner.id });
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "unhide" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id]);
    expect(await activitiesOf(owner)).toHaveLength(1);
  });

  it("leaves out an author who left the organization since", async () => {
    const { owner, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const formerMember = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
    const { template } = await seedPublicTemplate({ createdById: formerMember.id });
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "promote_official" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id]);
    expect(await activitiesOf(formerMember)).toEqual([]);
  });

  it("tells the publisher of a template staff removed, by the title its removed page keeps and with no link to it", async () => {
    const { owner, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const { template } = await seedPublicTemplate({ title: "Miner", moderationStatus: "removed", visibility: "private", sdl: "", removedBy: "staff" });
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "remove" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent).toMatchObject([{ userId: owner.id, notificationId: `templateRemoved.${event.id}.${owner.id}` }]);
    expect(notifications.sent[0].payload.summary).toBe('"Miner" was removed');
    expect(notifications.sent[0].payload.actions).toBeUndefined();
    expect(await activitiesOf(owner)).toMatchObject([{ meta: { summary: '"Miner" was removed', templateId: template.id } }]);
  });

  it("tells the owners and admins of a suspended publisher, naming the organization and no template", async () => {
    const { organization, owner, addMember, answerNotifications, notify, activitiesOf } = await setup({ organizationName: "Acme Cloud" });
    const admin = await addMember("admin");
    await addMember("member");
    const event = await seedTemplateModerationEvent({ organizationId: organization.id, action: "suspend_publisher", reason: "Repeated miners." });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => [sent.userId, sent.payload.summary, sent.payload.actions])).toEqual([
      [owner.id, "Publishing is suspended for Acme Cloud", undefined],
      [admin.id, "Publishing is suspended for Acme Cloud", undefined]
    ]);
    expect(notifications.sent[0].payload.description).toContain("<p><strong>Reason:</strong> Repeated miners.</p>");
    const [activity] = await activitiesOf(owner);
    expect(activity).toMatchObject({ organizationId: organization.id, dedupeKey: `templateNotice:publisher_suspended:${event.id}` });
    expect(activity.meta).toEqual({ summary: "Publishing is suspended for Acme Cloud" });
  });

  it("tells everyone but the person who saved it that a version failed its checks, with what the checks found", async () => {
    const { owner, addMember, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const admin = await addMember("admin");
    const { template } = await seedPublicTemplate({ title: "Postgres 16", createdById: owner.id });
    const failed = await seedTemplateVersion({
      templateId: template.id,
      version: 2,
      status: "failed_checks",
      checkResults: FAILED_CHECKS,
      createdById: admin.id,
      isCurrent: false
    });
    const notifications = answerNotifications();

    await notify({ source: "version_failed_checks", versionId: failed.id, savedByUserId: admin.id });

    expect(notifications.sent).toMatchObject([{ userId: owner.id, notificationId: `templateVersionFailedChecks.${failed.id}.${owner.id}` }]);
    expect(notifications.sent[0].payload.summary).toBe('Version 2 of "Postgres 16" failed the publish checks');
    expect(notifications.sent[0].payload.description).toContain("<p><strong>What the checks found:</strong><br>POSTGRES_PASSWORD is set in plain text.</p>");
    expect(await activitiesOf(admin)).toEqual([]);
    expect(await activitiesOf(owner)).toMatchObject([{ dedupeKey: `templateNotice:version_failed_checks:${failed.id}` }]);
  });

  it("tells the author too that their version is held for review", async () => {
    const { owner, addMember, seedPublicTemplate, answerNotifications, notify } = await setup();
    const author = await addMember("member");
    const { template } = await seedPublicTemplate({ title: "Postgres 16", createdById: owner.id });
    const held = await seedTemplateVersion({
      templateId: template.id,
      version: 2,
      status: "held",
      createdById: author.id,
      isCurrent: false,
      holdReasons: [{ kind: "global_port_added", message: 'Service "web" opens port 22 (tcp) to the internet.', service: "web", port: 22, protocol: "tcp" }]
    });
    const notifications = answerNotifications();

    await notify({ source: "version_held", versionId: held.id });

    expect(notifications.sent.map(sent => [sent.userId, sent.notificationId, sent.payload.summary])).toEqual([
      [owner.id, `templateVersionHeld.${held.id}.${owner.id}`, 'Version 2 of "Postgres 16" is waiting for review'],
      [author.id, `templateVersionHeld.${held.id}.${author.id}`, 'Version 2 of "Postgres 16" is waiting for review']
    ]);
    expect(notifications.sent[0].payload.description).not.toContain("What the checks found");
    expect(notifications.sent[0].payload.description).toContain(
      "<p><strong>Why it waits for review:</strong><br>Service &quot;web&quot; opens port 22 (tcp) to the internet.</p>"
    );
  });

  it("adds the notice to the feed of a member with no email address and emails the others", async () => {
    const { owner, addMember, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const adminWithoutEmail = await addMember("admin", { email: null });
    const { template } = await seedPublicTemplate();
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "hide" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id]);
    expect(await activitiesOf(adminWithoutEmail)).toHaveLength(1);
  });

  it.each([
    { name: "an event that does not exist", source: () => ({ source: "moderation" as const, eventId: faker.string.uuid() }) },
    { name: "a version that does not exist", source: () => ({ source: "version_held" as const, versionId: faker.string.uuid() }) }
  ])("completes without telling anyone about $name", async ({ source }) => {
    const { answerNotifications, notify } = await setup();
    const notifications = answerNotifications();

    await notify(source());

    expect(notifications.sent).toEqual([]);
  });

  it("completes without telling anyone about an action no notice exists for, or a template deleted since", async () => {
    const { owner, organization, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const { template } = await seedPublicTemplate();
    const featured = await seedTemplateModerationEvent({ templateId: template.id, organizationId: organization.id, action: "feature" });
    const hiddenThenDeleted = await seedTemplateModerationEvent({ templateId: faker.string.uuid(), action: "hide" });
    const notifications = answerNotifications();

    await notify({ source: "moderation", eventId: featured.id });
    await notify({ source: "moderation", eventId: hiddenThenDeleted.id });

    expect(notifications.sent).toEqual([]);
    expect(await activitiesOf(owner)).toEqual([]);
  });

  it("retries when no email went out, then emails once and repeats no entry of the feed", async () => {
    const { owner, seedPublicTemplate, answerNotifications, enqueue, startWorkers, activitiesOf } = await setup();
    const { template } = await seedPublicTemplate();
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "hide" });
    const source = { source: "moderation" as const, eventId: event.id };
    const selector = { singletonKey: notifyTemplatePublishersKeyFor(source) };
    const notifications = answerNotifications();
    notifications.isUp = false;

    await enqueue(source);
    await startWorkers();
    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(JOB, selector);
        expect(row.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
    expect(notifications.sent).toEqual([]);

    notifications.isUp = true;
    await makeJobDue(JOB, selector);
    await expectJobCompleted(JOB, selector);

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id]);
    expect(await activitiesOf(owner)).toHaveLength(1);
  });

  it("completes once one email went out, so a retry repeats none that was delivered", async () => {
    const { owner, addMember, seedPublicTemplate, answerNotifications, notify, activitiesOf } = await setup();
    const admin = await addMember("admin");
    const { template } = await seedPublicTemplate();
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "hide" });
    const notifications = answerNotifications();
    notifications.refusedUserIds.push(admin.id);

    await notify({ source: "moderation", eventId: event.id });

    expect(notifications.sent.map(sent => sent.userId)).toEqual([owner.id]);
    expect(await activitiesOf(admin)).toHaveLength(1);
  });

  it("keeps one notice queued for an event queued twice", async () => {
    const { seedPublicTemplate, enqueue } = await setup();
    const { template } = await seedPublicTemplate();
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "feature" });
    const source = { source: "moderation" as const, eventId: event.id };

    await enqueue(source);
    await enqueue(source);

    expect(await findJobRows(JOB, { singletonKey: notifyTemplatePublishersKeyFor(source) })).toHaveLength(1);
  });

  async function setup(input: { organizationName?: string } = {}) {
    const { enqueue: enqueueJob, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { user: owner, organization } = await seedOrganizationWithOwner({
      user: { email: faker.internet.email(), userId: faker.string.uuid() },
      ...(input.organizationName && { name: input.organizationName })
    });

    async function addMember(role: OrganizationRole, overrides: { email?: string | null } = {}) {
      const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), ...overrides });
      await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role });

      return user;
    }

    async function seedPublicTemplate({
      createdById = owner.id,
      version: versionNumber = 1,
      ...overrides
    }: Parameters<typeof seedTemplate>[0] & { createdById?: string; version?: number } = {}) {
      const template = await seedTemplate({ organizationId: organization.id, visibility: "public", publishedAt: new Date(), ...overrides });
      const version = await seedTemplateVersion({ templateId: template.id, version: versionNumber, createdById });

      return { template, version };
    }

    function answerNotifications() {
      const state = { sent: [] as SentNotification[], isUp: true, refusedUserIds: [] as string[] };
      nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          const userId = this.req.headers["x-user-id"] as string | undefined;
          if (!state.isUp || (userId && state.refusedUserIds.includes(userId))) return [503];
          state.sent.push({ userId, ...(body as Omit<SentNotification, "userId">) });
          return [204];
        });

      return state;
    }

    async function enqueue(source: TemplatePublisherNoticeSource) {
      await enqueueJob(new NotifyTemplatePublishers(source), {
        singletonKey: notifyTemplatePublishersKeyFor(source),
        ...NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS
      });
    }

    async function notify(source: TemplatePublisherNoticeSource) {
      await enqueue(source);
      await startWorkers();
      await expectJobCompleted(JOB, { singletonKey: notifyTemplatePublishersKeyFor(source) });
    }

    async function activitiesOf(user: { id: string }) {
      const activities = resolveTable("Activities");

      return await db.select().from(activities).where(eq(activities.userId, user.id));
    }

    return { organization, owner, addMember, seedPublicTemplate, answerNotifications, enqueue, startWorkers, notify, activitiesOf };
  }
});
