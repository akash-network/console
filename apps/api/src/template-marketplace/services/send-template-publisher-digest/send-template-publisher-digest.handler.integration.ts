import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PurgeExpiredActivitiesHandler } from "@src/activity/services/purge-expired-activities/purge-expired-activities.handler";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { digestWeekEndingBefore, nextDigestRunAt } from "@src/template-marketplace/lib/publisher-digest/publisher-digest";
import { SendTemplatePublisherDigestHandler } from "./send-template-publisher-digest.handler";
import { SendTemplatePublisherDigest, sendTemplatePublisherDigestKeyFor } from "./send-template-publisher-digest.job";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplateUsageEvent } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const JOB = SendTemplatePublisherDigest[JOB_NAME];
const DAY_MS = 24 * 60 * 60 * 1000;

type SentNotification = { userId: string | undefined; notificationId: string; payload: { summary: string; description: string } };

const jobWorkers = useJobWorkers(() => [container.resolve(SendTemplatePublisherDigestHandler), container.resolve(PurgeExpiredActivitiesHandler)]);

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe(SendTemplatePublisherDigestHandler.name, () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", faker.string.alphanumeric(32));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("tells the owners and admins the marketplace is on for how their templates did and which passed a milestone, run the way a worker runs it", async () => {
    const { owner, addMember, seedPublicTemplate, deploy, view, answerNotifications, sendDigest, activitiesOf, turnMarketplaceOffFor, weekEndsOn } = await setup();
    const admin = await addMember("admin");
    const unsubscribedAdmin = await addMember("admin", { productUpdatesUnsubscribedAt: new Date() });
    const member = await addMember("member");
    const adminWithoutMarketplace = await addMember("admin");
    turnMarketplaceOffFor(adminWithoutMarketplace);
    const template = await seedPublicTemplate({ title: "Postgres 16" });
    await deploy(template, 8, daysAgo(30));
    await deploy(template, 1, daysAgo(12));
    await deploy(template, 3, daysAgo(5));
    await deploy(template, 2, daysAgo(5), { organizationId: template.organizationId });
    await view(template, 4, daysAgo(5));
    const notifications = answerNotifications();

    await sendDigest();

    const templateUrl = `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/template/${template.id}`;
    const digestSummary = "Your templates last week: 3 deploys, 4 views";
    const milestoneSummary = '"Postgres 16" passed 10 deploys';
    expect(notifications.sent.map(({ userId, notificationId, payload }) => ({ userId, notificationId, summary: payload.summary }))).toEqual(
      [owner, admin].flatMap(recipient => [
        { userId: recipient.id, notificationId: `templatePublisherDigest.${template.organizationId}.${weekEndsOn}.${recipient.id}`, summary: digestSummary },
        { userId: recipient.id, notificationId: `templateMilestone.${template.id}.10.${recipient.id}`, summary: milestoneSummary }
      ])
    );
    expect(notifications.sent[0].payload.description).toContain(
      `<p><strong>Postgres 16</strong><br>4 views, 3 deploys (+200% vs the week before), 0 still running after 24 hours<br><a href="${templateUrl}?tab=insights">See its insights</a></p>`
    );
    for (const recipient of [owner, admin, unsubscribedAdmin]) {
      expect((await activitiesOf(recipient)).map(({ type, status, meta, dedupeKey }) => ({ type, status, meta, dedupeKey }))).toEqual(
        expect.arrayContaining([
          { type: "template_update", status: "info", meta: { summary: digestSummary }, dedupeKey: `templateDigest:${template.organizationId}:${weekEndsOn}` },
          { type: "template_update", status: "info", meta: { summary: milestoneSummary, templateId: template.id }, dedupeKey: `templateMilestone:${template.id}:10` }
        ])
      );
    }
    expect(await activitiesOf(member)).toEqual([]);
    expect(await activitiesOf(adminWithoutMarketplace)).toEqual([]);
  });

  it("queues the next week's digest for the coming Monday afternoon", async () => {
    const { sendDigest, answerNotifications } = await setup();
    answerNotifications();
    const nextRunAt = nextDigestRunAt(new Date());

    await sendDigest();

    const [nextRun] = await findJobRows(JOB, { singletonKey: sendTemplatePublisherDigestKeyFor(digestWeekEndingBefore(nextRunAt)), state: "created" });
    expect(nextRun).toMatchObject({ data: { weekEndsOn: digestWeekEndingBefore(nextRunAt) } });
    expect(new Date(nextRun.start_after).toISOString()).toBe(nextRunAt.toISOString());
  });

  it("tells nothing of a week only the publisher's own organization used the template, nor of a milestone it passed before the week", async () => {
    const { owner, seedPublicTemplate, deploy, view, answerNotifications, sendDigest, activitiesOf } = await setup();
    const quiet = await seedPublicTemplate({ title: "Quiet" });
    await deploy(quiet, 12, daysAgo(30));
    await view(quiet, 50, daysAgo(12));
    await view(quiet, 7, daysAgo(5), { fromPublisher: true });
    const notifications = answerNotifications();

    await sendDigest();

    expect(notifications.sent.filter(({ userId }) => userId === owner.id)).toEqual([]);
    expect(await activitiesOf(owner)).toEqual([]);
  });

  it("tells how a template did in a week people only viewed it", async () => {
    const { owner, seedPublicTemplate, view, answerNotifications, sendDigest } = await setup();
    const template = await seedPublicTemplate({ title: "Browsed" });
    await view(template, 3, daysAgo(5));
    const notifications = answerNotifications();

    await sendDigest();

    expect(notifications.sent.filter(({ userId }) => userId === owner.id).map(({ payload }) => payload.summary)).toEqual([
      "Your templates last week: 0 deploys, 3 views"
    ]);
  });

  it("tells each member once when the week's digest runs again", async () => {
    const { owner, seedPublicTemplate, deploy, answerNotifications, sendDigest, activitiesOf } = await setup();
    const template = await seedPublicTemplate({ title: "Redis" });
    await deploy(template, 10, daysAgo(5));
    const notifications = answerNotifications();

    await sendDigest();
    await sendDigest();

    expect(notifications.sent.filter(({ userId }) => userId === owner.id).map(({ notificationId }) => notificationId)).toEqual([
      expect.stringMatching(/^templatePublisherDigest\./),
      `templateMilestone.${template.id}.10.${owner.id}`
    ]);
    expect(await activitiesOf(owner)).toHaveLength(2);
  });

  it("keeps the app entry and tells the other members when one email fails", async () => {
    const { owner, addMember, seedPublicTemplate, deploy, answerNotifications, sendDigest, activitiesOf } = await setup();
    const admin = await addMember("admin");
    const template = await seedPublicTemplate({ title: "Valkey" });
    await deploy(template, 1, daysAgo(5));
    const notifications = answerNotifications();
    notifications.refusedUserIds.push(owner.id);

    await sendDigest();

    expect(notifications.sent.map(({ userId }) => userId)).toEqual([admin.id]);
    expect(await activitiesOf(owner)).toHaveLength(1);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await deleteQueuedJobs(JOB);
    await deleteCompletedJobs(JOB);
    const weekEndsOn = dayOf(daysAgo(3));
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { email: faker.internet.email(), userId: faker.string.uuid() } });
    const marketplaceOffUserIds: string[] = [];
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabledForSubject").mockImplementation((_flag, subjectId) => !marketplaceOffUserIds.includes(subjectId));

    async function addMember(role: OrganizationRole, overrides: { productUpdatesUnsubscribedAt?: Date } = {}) {
      const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), ...overrides });
      await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role });

      return user;
    }

    async function seedPublicTemplate(overrides: Parameters<typeof seedTemplate>[0] = {}) {
      return await seedTemplate({ organizationId: organization.id, visibility: "public", publishedAt: new Date(), ...overrides });
    }

    async function deploy(template: { id: string }, count: number, createdAt: Date, overrides: { organizationId?: string } = {}) {
      for (let index = 0; index < count; index++) {
        await seedTemplateUsageEvent({ templateRef: template.id, action: "deploy", createdAt, ...overrides });
      }
    }

    async function view(template: { id: string }, viewers: number, on: Date, overrides: { fromPublisher?: boolean } = {}) {
      await db.insert(resolveTable("TemplateViewEvents")).values(
        Array.from({ length: viewers }, () => ({
          templateId: template.id,
          kind: "page_view" as const,
          viewerKey: faker.string.hexadecimal({ length: 64, prefix: "" }),
          fromPublisher: overrides.fromPublisher ?? false,
          network: "mainnet",
          viewedOn: dayOf(on)
        }))
      );
    }

    function answerNotifications() {
      const state = { sent: [] as SentNotification[], refusedUserIds: [] as string[] };
      nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          const userId = this.req.headers["x-user-id"] as string | undefined;
          if (userId && state.refusedUserIds.includes(userId)) return [400];
          state.sent.push({ userId, ...(body as Omit<SentNotification, "userId">) });
          return [204];
        });

      return state;
    }

    async function sendDigest() {
      await deleteCompletedJobs(JOB);
      await enqueue(new SendTemplatePublisherDigest({ weekEndsOn }), { singletonKey: sendTemplatePublisherDigestKeyFor(weekEndsOn) });
      await startWorkers();
      await expectJobCompleted(JOB, { singletonKey: sendTemplatePublisherDigestKeyFor(weekEndsOn) });
    }

    async function activitiesOf(user: { id: string }) {
      const activities = resolveTable("Activities");

      return await db.select().from(activities).where(eq(activities.userId, user.id));
    }

    return {
      owner,
      weekEndsOn,
      addMember,
      seedPublicTemplate,
      deploy,
      view,
      answerNotifications,
      sendDigest,
      activitiesOf,
      turnMarketplaceOffFor: (user: { id: string }) => marketplaceOffUserIds.push(user.id)
    };
  }
});
