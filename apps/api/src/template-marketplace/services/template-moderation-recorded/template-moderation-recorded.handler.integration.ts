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

const jobWorkers = useJobWorkers(() => [
  container.resolve(TemplateModerationRecordedHandler),
  container.resolve(NotifyTemplatePublishersHandler),
  container.resolve(PurgeExpiredActivitiesHandler)
]);

describe(TemplateModerationRecordedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it.each(["approve_version", "reject_version", "hide", "unhide", "promote_official", "remove_official"] satisfies TemplateModerationAction[])(
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

  it.each([
    "rollback_version",
    "feature",
    "unfeature",
    "edit_categories",
    "accept_image_change",
    "verify_publisher",
    "unverify_publisher"
  ] satisfies TemplateModerationAction[])("queues no notice of a recorded %s", async action => {
    const { handler, organization } = await setup();
    const template = await seedPublicTemplate(organization.id);
    const event = await seedTemplateModerationEvent({ templateId: template.id, organizationId: organization.id, action });

    await handler.handle({ eventId: event.id, version: 1 });

    expect(await findNoticeJobs(event.id)).toEqual([]);
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
