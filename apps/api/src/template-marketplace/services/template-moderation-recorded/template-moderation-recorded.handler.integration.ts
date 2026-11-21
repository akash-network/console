import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { PurgeExpiredActivitiesHandler } from "@src/activity/services/purge-expired-activities/purge-expired-activities.handler";
import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { TemplateModerationAction } from "@src/template-marketplace/model-schemas/template-moderation-event/template-moderation-event.schema";
import { NotifyTemplatePublishersHandler } from "@src/template-marketplace/services/notify-template-publishers/notify-template-publishers.handler";
import {
  NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS,
  NotifyTemplatePublishers,
  notifyTemplatePublishersKeyFor
} from "@src/template-marketplace/services/notify-template-publishers/notify-template-publishers.job";
import { TemplateModerationRecordedHandler } from "./template-moderation-recorded.handler";
import { TemplateModerationRecorded, templateModerationRecordedKeyFor } from "./template-moderation-recorded.job";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import {
  findStoredTemplate,
  findStoredTemplateVersions,
  SEEDED_TEMPLATE_SDL,
  seedTemplate,
  seedTemplateModerationEvent,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";
import { deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const NOTICE_JOB = NotifyTemplatePublishers[JOB_NAME];
const APPROVED_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.27",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          size: 1Gi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uakt",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

const jobWorkers = useJobWorkers(() => [
  container.resolve(TemplateModerationRecordedHandler),
  container.resolve(NotifyTemplatePublishersHandler),
  container.resolve(PurgeExpiredActivitiesHandler)
]);

describe(TemplateModerationRecordedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it.each(["reject_version", "hide", "unhide", "promote_official", "remove_official"] satisfies TemplateModerationAction[])(
    "queues one notice of a recorded %s, with the retries that outlast a notifications outage, and leaves the template as staff left it",
    async action => {
      const { handler, organization } = await setup();
      const template = await seedPublicTemplate(organization.id);
      const event = await seedTemplateModerationEvent({ templateId: template.id, action });

      await handler.handle({ eventId: event.id, version: 1 });
      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findNoticeJobs(event.id)).toEqual([
        expect.objectContaining({
          state: "created",
          data: { source: "moderation", eventId: event.id, version: 1 },
          retry_limit: NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS.retryLimit,
          retry_delay: NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS.retryDelay,
          retry_delay_max: NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS.retryDelayMax,
          retry_backoff: true
        })
      ]);
      expect(await findStoredTemplate(template.id)).toMatchObject({ sdl: SEEDED_TEMPLATE_SDL, moderationStatus: "active", visibility: "public" });
    }
  );

  it.each(["suspend_publisher", "reinstate_publisher"] satisfies TemplateModerationAction[])(
    "queues one notice of a recorded %s, which names no template",
    async action => {
      const { handler, organization } = await setup();
      const event = await seedTemplateModerationEvent({ organizationId: organization.id, action });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findNoticeJobs(event.id)).toMatchObject([{ state: "created", data: { source: "moderation", eventId: event.id } }]);
    }
  );

  it.each(["feature", "unfeature", "edit_categories", "accept_image_change", "verify_publisher", "unverify_publisher"] satisfies TemplateModerationAction[])(
    "queues no notice of a recorded %s",
    async action => {
      const { handler, organization } = await setup();
      const template = await seedPublicTemplate(organization.id);
      const event = await seedTemplateModerationEvent({ templateId: template.id, organizationId: organization.id, action });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findNoticeJobs(event.id)).toEqual([]);
    }
  );

  describe("an approved version", () => {
    it("becomes the version people deploy, with the legacy columns following it, and its publisher is told once however often the job runs", async () => {
      const { handler, organization } = await setup();
      const { template, current } = await seedPublicTemplateWithVersion(organization.id);
      const approved = await seedReviewedVersion(template.id, { version: 2, status: "live", sdl: APPROVED_SDL, readme: "# Approved", reviewedAt: new Date() });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: approved.id, action: "approve_version" });

      await handler.handle({ eventId: event.id, version: 1 });
      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({
        currentVersionId: approved.id,
        sdl: APPROVED_SDL,
        description: "# Approved",
        cpu: 500,
        ram: 512 * 1024 * 1024,
        storage: 1024 * 1024 * 1024
      });
      expect(current.id).not.toBe(approved.id);
      expect(await findNoticeJobs(event.id)).toHaveLength(1);
    });

    it("mirrors the resources the version recorded and an empty description for a version without a readme", async () => {
      const { handler, organization } = await setup();
      const { template } = await seedPublicTemplateWithVersion(organization.id);
      const approved = await seedReviewedVersion(template.id, {
        version: 2,
        status: "live",
        readme: null,
        resources: { cpu: 2, memoryBytes: 2048, storageBytes: 4096 }
      });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: approved.id, action: "approve_version" });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: approved.id, description: "", cpu: 2000, ram: 2048, storage: 4096 });
    });

    it.each(["live", "held"] as const)("stays out of the way, and its publisher untold, when a %s version was saved after it", async newer => {
      const { handler, organization } = await setup();
      const { template, current } = await seedPublicTemplateWithVersion(organization.id);
      const approved = await seedReviewedVersion(template.id, { version: 2, status: "live", sdl: APPROVED_SDL });
      await seedReviewedVersion(template.id, { version: 3, status: newer });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: approved.id, action: "approve_version" });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: current.id, sdl: SEEDED_TEMPLATE_SDL, description: "# Readme" });
      expect(await findNoticeJobs(event.id)).toEqual([]);
    });

    it.each(["failed_checks", "rejected"] as const)("becomes current past a newer version that is %s", async newer => {
      const { handler, organization } = await setup();
      const { template } = await seedPublicTemplateWithVersion(organization.id);
      const approved = await seedReviewedVersion(template.id, { version: 2, status: "live" });
      await seedReviewedVersion(template.id, { version: 3, status: newer });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: approved.id, action: "approve_version" });

      await handler.handle({ eventId: event.id, version: 1 });

      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(approved.id);
      expect(await findNoticeJobs(event.id)).toHaveLength(1);
    });

    it.each(["held", "rejected", "failed_checks"] as const)("changes nothing and tells nobody when staff left the version %s", async status => {
      const { handler, organization } = await setup();
      const { template, current } = await seedPublicTemplateWithVersion(organization.id);
      const unapproved = await seedReviewedVersion(template.id, { version: 2, status });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: unapproved.id, action: "approve_version" });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: current.id, sdl: SEEDED_TEMPLATE_SDL });
      expect(await findNoticeJobs(event.id)).toEqual([]);
    });

    it("changes nothing and tells nobody when the event names no version, another template's version, or a removed template", async () => {
      const { handler, organization } = await setup();
      const { template, current } = await seedPublicTemplateWithVersion(organization.id);
      const other = await seedPublicTemplateWithVersion(organization.id);
      const removed = await seedPublicTemplateWithVersion(organization.id, { moderationStatus: "removed" });
      const ofRemoved = await seedReviewedVersion(removed.template.id, { version: 2, status: "live" });
      const events = await Promise.all([
        seedTemplateModerationEvent({ templateId: template.id, action: "approve_version" }),
        seedTemplateModerationEvent({ templateId: template.id, templateVersionId: other.current.id, action: "approve_version" }),
        seedTemplateModerationEvent({ templateId: removed.template.id, templateVersionId: ofRemoved.id, action: "approve_version" }),
        seedTemplateModerationEvent({ organizationId: organization.id, templateVersionId: current.id, action: "approve_version" })
      ]);

      for (const event of events) await handler.handle({ eventId: event.id, version: 1 });

      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(current.id);
      expect((await findStoredTemplate(removed.template.id)).currentVersionId).toBe(removed.current.id);
      expect((await Promise.all(events.map(event => findNoticeJobs(event.id)))).flat()).toEqual([]);
    });

    it("goes live and its publisher is told, run the way a worker runs it", async () => {
      const { owner, organization, enqueue, startWorkers } = await setup();
      const { template } = await seedPublicTemplateWithVersion(organization.id, { title: "Postgres 16" });
      const approved = await seedReviewedVersion(template.id, { version: 2, status: "live", sdl: APPROVED_SDL, readme: "# Approved" });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: approved.id, action: "approve_version" });
      await deleteQueuedJobs(NOTICE_JOB);
      nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(204);

      await enqueue(new TemplateModerationRecorded({ eventId: event.id }), { singletonKey: templateModerationRecordedKeyFor(event.id) });
      await startWorkers();

      await expectJobCompleted(TemplateModerationRecorded[JOB_NAME], { singletonKey: templateModerationRecordedKeyFor(event.id) });
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: approved.id, sdl: APPROVED_SDL, description: "# Approved" });
      await expectJobCompleted(NOTICE_JOB, { singletonKey: notifyTemplatePublishersKeyFor({ source: "moderation", eventId: event.id }) });
      expect(await container.resolve(ActivityRepository).find({ userId: owner.id })).toMatchObject([
        { type: "template_update", meta: { summary: 'Version 2 of "Postgres 16" is live', templateId: template.id } }
      ]);
    });
  });

  describe("a rollback", () => {
    it("brings the legacy columns back to the version staff rolled the template to, and tells nobody", async () => {
      const { handler, organization } = await setup();
      const template = await seedTemplate({
        organizationId: organization.id,
        visibility: "public",
        sdl: APPROVED_SDL,
        description: "# Newer",
        cpu: 9,
        ram: 9,
        storage: 9
      });
      const earlier = await seedTemplateVersion({ templateId: template.id, version: 1, sdl: SEEDED_TEMPLATE_SDL, readme: "# Earlier", isCurrent: true });
      await seedTemplateVersion({ templateId: template.id, version: 2, sdl: APPROVED_SDL, readme: "# Newer", isCurrent: false });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: earlier.id, action: "rollback_version" });

      await handler.handle({ eventId: event.id, version: 1 });
      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({
        currentVersionId: earlier.id,
        sdl: SEEDED_TEMPLATE_SDL,
        description: "# Earlier",
        cpu: 0,
        ram: 0,
        storage: 0
      });
      expect(await findNoticeJobs(event.id)).toEqual([]);
    });

    it("keeps the description a version without a readme of its own always showed", async () => {
      const { handler, organization } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, visibility: "public", sdl: APPROVED_SDL, description: "Legacy description" });
      const earlier = await seedTemplateVersion({ templateId: template.id, version: 1, sdl: SEEDED_TEMPLATE_SDL, readme: null, isCurrent: true });
      const event = await seedTemplateModerationEvent({ templateId: template.id, templateVersionId: earlier.id, action: "rollback_version" });

      await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({ sdl: SEEDED_TEMPLATE_SDL, description: "Legacy description" });
    });

    it("mirrors nothing when the template does not point at the version the event names, or the event names none", async () => {
      const { handler, organization } = await setup();
      const { template, current } = await seedPublicTemplateWithVersion(organization.id);
      const notCurrent = await seedReviewedVersion(template.id, { version: 2, status: "live", sdl: APPROVED_SDL });
      const events = await Promise.all([
        seedTemplateModerationEvent({ templateId: template.id, templateVersionId: notCurrent.id, action: "rollback_version" }),
        seedTemplateModerationEvent({ templateId: template.id, action: "rollback_version" })
      ]);

      for (const event of events) await handler.handle({ eventId: event.id, version: 1 });

      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: current.id, sdl: SEEDED_TEMPLATE_SDL, description: "# Readme" });
    });
  });

  it("leaves a template alone, and its publisher untold, when a removal names one nobody marked removed", async () => {
    const { handler, organization } = await setup();
    const template = await seedPublicTemplate(organization.id);
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "remove" });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findStoredTemplate(template.id)).toMatchObject({ sdl: SEEDED_TEMPLATE_SDL, moderationStatus: "active", removedBy: null });
    expect(await findNoticeJobs(event.id)).toEqual([]);
  });

  it("queues no notice of a removal that names no template", async () => {
    const { handler, organization } = await setup();
    const event = await seedTemplateModerationEvent({ organizationId: organization.id, action: "remove" });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findNoticeJobs(event.id)).toEqual([]);
  });

  it("empties a removed template that was never public and keeps the owner's removal of one staff later recorded", async () => {
    const { handler, organization } = await setup();
    const neverPublic = await seedTemplate({ organizationId: organization.id, moderationStatus: "removed", description: "Draft" });
    const event = await seedTemplateModerationEvent({ templateId: neverPublic.id, action: "remove" });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findStoredTemplate(neverPublic.id)).toMatchObject({ sdl: "", description: null, removedBy: "staff", removedAt: expect.any(Date) });
    expect(await findNoticeJobs(event.id)).toHaveLength(1);
  });

  it("does nothing for an event that does not exist", async () => {
    const { handler } = await setup();
    const eventId = faker.string.uuid();

    await expect(handler.handle({ eventId, version: 1 })).resolves.toBeUndefined();

    expect(await findNoticeJobs(eventId)).toEqual([]);
  });

  it("empties a template staff marked removed and tells its publisher, run the way a worker runs it", async () => {
    const { owner, organization, enqueue, startWorkers } = await setup();
    const removedAt = new Date("2026-11-01T10:00:00.000Z");
    const template = await seedPublicTemplate(organization.id, { title: "Postgres 16", moderationStatus: "removed", removedAt, removedBy: "staff" });
    const event = await seedTemplateModerationEvent({ templateId: template.id, action: "remove" });
    await deleteQueuedJobs(NOTICE_JOB);
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(204);

    await enqueue(new TemplateModerationRecorded({ eventId: event.id }), { singletonKey: templateModerationRecordedKeyFor(event.id) });
    await startWorkers();

    await expectJobCompleted(TemplateModerationRecorded[JOB_NAME], { singletonKey: templateModerationRecordedKeyFor(event.id) });
    expect(await findStoredTemplate(template.id)).toMatchObject({
      title: "Postgres 16",
      sdl: "",
      description: null,
      moderationStatus: "removed",
      removedAt,
      removedBy: "staff",
      visibility: "private",
      isPublic: false
    });
    expect(await findStoredTemplateVersions(template.id)).toMatchObject([{ sdl: "", readme: null }]);
    await expectJobCompleted(NOTICE_JOB, { singletonKey: notifyTemplatePublishersKeyFor({ source: "moderation", eventId: event.id }) });
    expect(await container.resolve(ActivityRepository).find({ userId: owner.id })).toMatchObject([
      { type: "template_update", organizationId: organization.id, meta: { summary: '"Postgres 16" was removed', templateId: template.id } }
    ]);
  });

  async function findNoticeJobs(eventId: string) {
    return await findJobRows(NOTICE_JOB, { singletonKey: notifyTemplatePublishersKeyFor({ source: "moderation", eventId }) });
  }

  async function seedPublicTemplateWithVersion(organizationId: string, overrides: Parameters<typeof seedTemplate>[0] = {}) {
    const template = await seedTemplate({ organizationId, visibility: "public", publishedAt: new Date(), description: "# Readme", ...overrides });
    const current = await seedTemplateVersion({ templateId: template.id, readme: "# Readme" });

    return { template, current };
  }

  async function seedReviewedVersion(templateId: string, overrides: Omit<Parameters<typeof seedTemplateVersion>[0], "templateId">) {
    return await seedTemplateVersion({ templateId, isCurrent: false, ...overrides });
  }

  async function seedPublicTemplate(organizationId: string, overrides: Parameters<typeof seedTemplate>[0] = {}) {
    const template = await seedTemplate({ organizationId, visibility: "public", publishedAt: new Date(), description: "# Readme", ...overrides });
    await seedTemplateVersion({ templateId: template.id, readme: "# Readme" });

    return template;
  }

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { email: faker.internet.email(), userId: faker.string.uuid() } });

    return { handler: container.resolve(TemplateModerationRecordedHandler), owner, organization, enqueue, startWorkers };
  }
});
