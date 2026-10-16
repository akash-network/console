import { faker } from "@faker-js/faker";
import { addHours, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Activities, type ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { SystemCloseActivityService } from "@src/deployment/services/system-close-activity/system-close-activity.service";
import { pendingCloseActivityOf, systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { PurgeExpiredActivitiesHandler } from "./purge-expired-activities.handler";
import {
  ACTIVITY_RETENTION_DAYS,
  PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE,
  PURGE_EXPIRED_ACTIVITIES_KEY,
  PurgeExpiredActivities
} from "./purge-expired-activities.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationActivity, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(PurgeExpiredActivitiesHandler)]);

describe(PurgeExpiredActivitiesHandler.name, () => {
  it("deletes every settled activity older than the retention window, a backlog past one batch included, run the way a worker runs it", async () => {
    const { seed, seedBacklog, purge, findActivity, countActivities } = await setup();
    const expired = subDays(new Date(), ACTIVITY_RETENTION_DAYS + 1);
    const oldSucceeded = await seed({ status: "succeeded", createdAt: expired });
    const oldFailed = await seed({ status: "failed", createdAt: expired });
    const oldPending = await seed({ status: "pending", createdAt: subDays(new Date(), ACTIVITY_RETENTION_DAYS * 2) });
    const recent = await seed({ status: "succeeded", createdAt: subDays(new Date(), ACTIVITY_RETENTION_DAYS - 1) });
    await seedBacklog(PURGE_EXPIRED_ACTIVITIES_BATCH_SIZE, expired);

    await purge();

    expect(await findActivity(oldSucceeded.id)).toBeUndefined();
    expect(await findActivity(oldFailed.id)).toBeUndefined();
    expect(await findActivity(oldPending.id)).toEqual(oldPending);
    expect(await findActivity(recent.id)).toEqual(recent);
    expect(await countActivities()).toBe(2);
  });

  it("keeps a team deployment's pending close whatever its age, so a close Console reports for it afterwards still lands on that entry", async () => {
    const { member, teamWallet, seedRow, purge, activitiesOf } = await setup();
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: member.id, organizationId: teamWallet.organizationId, dseq });
    const pendingClose = await seedRow({
      ...pendingCloseActivityOf({ userId: member.id, owner: teamWallet.address, dseq }),
      createdAt: subDays(new Date(), ACTIVITY_RETENTION_DAYS * 2)
    });

    await purge();
    await container.resolve(SystemCloseActivityService).record({ wallet: teamWallet, dseq, reason: "runtime_limit_reached" });

    expect(await activitiesOf(member.id)).toEqual([pendingClose]);
  });

  it("clears a team deployment's expired close from the member's feed and leaves the organization's feed alone", async () => {
    const { member, teamWallet, seedRow, purge, findActivity, findOrganizationActivity } = await setup();
    const expired = subDays(new Date(), ACTIVITY_RETENTION_DAYS + 1);
    const expiredClose = await seedRow({
      ...systemClosedActivityOf({ userId: member.id, owner: teamWallet.address, dseq: createDseq(), reason: "no_lease" }),
      createdAt: expired
    });
    const organizationActivity = await seedOrganizationActivity({ organizationId: teamWallet.organizationId, createdAt: expired });

    await purge();

    expect(await findActivity(expiredClose.id)).toBeUndefined();
    expect(await findOrganizationActivity(organizationActivity.id)).toEqual(organizationActivity);
  });

  it("queues one purge a day ahead when the feed is written to, however many writes follow", async () => {
    const { recordActivity } = await setup();

    await recordActivity();
    await recordActivity();

    const queued = await findJobRows(PurgeExpiredActivities[JOB_NAME], { singletonKey: PURGE_EXPIRED_ACTIVITIES_KEY, state: "created" });
    expect(queued).toHaveLength(1);
    expect(new Date(queued[0].start_after).getTime()).toBeGreaterThan(addHours(new Date(), 23).getTime());
    expect(queued[0]).toMatchObject({ retry_limit: 5, retry_backoff: true, retry_delay: 60, retry_delay_max: 3600 });
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const member = await seedUser();
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: member.id });
    const activityRepository = container.resolve(ActivityRepository);
    const { enqueue, startWorkers } = await jobWorkers();

    async function seedRow(input: Parameters<ActivityRepository["create"]>[0]) {
      return await activityRepository.create(input);
    }

    async function seed({ status, createdAt }: { status: ActivityStatus; createdAt: Date }) {
      return await seedRow({ userId: member.id, type: "deployment_close", status, meta: { dseq: createDseq() }, createdAt });
    }

    async function seedBacklog(size: number, createdAt: Date) {
      await db
        .insert(Activities)
        .values(Array.from({ length: size }, () => ({ userId: member.id, type: "deployment_close" as const, status: "succeeded" as const, createdAt })));
    }

    async function purge() {
      const singletonKey = faker.string.uuid();
      await enqueue(new PurgeExpiredActivities(), { singletonKey });
      await startWorkers();
      await expectJobCompleted(PurgeExpiredActivities[JOB_NAME], { singletonKey });
    }

    async function recordActivity() {
      await container
        .resolve(ActivityService)
        .record({ userId: member.id, type: "deployment_close", status: "failed", initiator: "user", meta: { dseq: createDseq() }, dedupeKey: null });
    }

    async function findOrganizationActivity(id: string) {
      const [activity] = await db
        .select()
        .from(resolveTable("OrganizationActivities"))
        .where(eq(resolveTable("OrganizationActivities").id, id));
      return activity;
    }

    return {
      member,
      teamWallet: { userId: null, organizationId: team.id, address: createAkashAddress() },
      seed,
      seedRow,
      seedBacklog,
      purge,
      recordActivity,
      findActivity: async (id: string) => await activityRepository.findById(id),
      findOrganizationActivity,
      activitiesOf: async (userId: string) => await activityRepository.find({ userId }),
      countActivities: async () => await activityRepository.count({ userId: member.id })
    };
  }
});
