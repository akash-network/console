import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME, JobQueueService } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { GpuSetupCheckService } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { LeaseGpuOfferService } from "@src/deployment/services/lease-gpu-offer/lease-gpu-offer.service";
import { RecordLeaseGpuOffers } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";
import { toPoolKey } from "@src/gpu-waitlist/lib/gpu-pool-key/gpu-pool-key";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistPoolRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { ConfirmGpuPools } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.job";
import { GpuAvailableNoticeJob } from "@src/gpu-waitlist/services/gpu-available-notice/gpu-available-notice.job";
import { WATCH_GPU_WAITLISTS_KEY } from "@src/gpu-waitlist/services/watch-gpu-waitlists/watch-gpu-waitlists.handler";
import { WatchGpuWaitlists } from "@src/gpu-waitlist/services/watch-gpu-waitlists/watch-gpu-waitlists.job";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, makeJobDue } from "@test/services/job-queue-harness";

vi.hoisted(() => {
  process.env.GPU_WAITLIST_NETWORKS = "mainnet,testnet,sandbox";
});

const WORKER_OPTIONS = { concurrency: 1, pollingIntervalSeconds: 0.5 };
const WAVE_SIZE = 3;
const POOL_KEY = toPoolKey({ vendor: "nvidia", model: "h100" });

describe("GPU waitlist waves", () => {
  beforeAll(async () => {
    await startJobQueues();
    await container.resolve(JobQueueService).startWorkers(WORKER_OPTIONS);
  }, 30_000);

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("notifies the first three users, the rest once the round window has passed, and fulfils an entry when its organization leases the gpu", async () => {
    const { users, provider, notifications, serveSupply, tickWatcher, waitForNotices, rewindPoolClocks, leaseOffers } = await setup();

    await tickWatcher();
    expect(await findJobRows(GpuAvailableNoticeJob[JOB_NAME])).toEqual([]);

    serveSupply({ nodeFreeUnits: 8 });
    await tickWatcher();
    await waitForNotices(WAVE_SIZE);
    const firstWave = await findJobRows<{ entryId: string }>(GpuAvailableNoticeJob[JOB_NAME]);
    expect(firstWave.map(job => job.data.entryId).sort()).toEqual(
      users
        .slice(0, WAVE_SIZE)
        .map(({ entry }) => entry.id)
        .sort()
    );
    expect(notifications.map(({ recipient }) => recipient).sort()).toEqual(
      users
        .slice(0, WAVE_SIZE)
        .map(({ user }) => user.email)
        .sort()
    );

    await rewindPoolClocks(20);
    await tickWatcher();
    await waitForNotices(users.length);
    expect(notifications.map(({ recipient }) => recipient).sort()).toEqual(users.map(({ user }) => user.email).sort());
    expect(await findJobRows(GpuAvailableNoticeJob[JOB_NAME])).toHaveLength(users.length);

    const [, second] = users;
    await leaseOffers(second, provider);

    const entries = container.resolve(GpuWaitlistEntryRepository);
    expect(await entries.findByIdAcrossOrganizations(second.entry.id)).toMatchObject({ status: "fulfilled", endedAt: expect.any(Date) });
    expect((await entries.findByIdAcrossOrganizations(users[0].entry.id))?.status).toBe("waiting");
    expect((await entries.findByIdAcrossOrganizations(users[3].entry.id))?.status).toBe("waiting");
  }, 120_000);

  async function setup() {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);
    const provider = createAkashAddress();
    await container
      .resolve(GpuBidCheckRepository)
      .insertMany([{ provider, vendor: "nvidia", model: "h100", source: "setup-check", dseq: "1", screened: true, bid: true, checkedAt: new Date() }]);

    const users = await joinFiveUsers();
    const notifications = captureNotifications();
    fakeSetupCheck(provider);

    let freeUnits = 0;
    nock(inventoryUrl())
      .persist()
      .get("/v1/gpu-supply")
      .query({ vendor: "nvidia", model: "h100" })
      .reply(200, () => ({
        data: freeUnits
          ? [{ owner: provider, node: 0, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5", units: 8, nodeFreeUnits: freeUnits }]
          : []
      }));

    function serveSupply({ nodeFreeUnits }: { nodeFreeUnits: number }) {
      freeUnits = nodeFreeUnits;
    }

    async function tickWatcher() {
      const jobQueue = container.resolve(JobQueueService);
      const watchesDone = await countJobs(WatchGpuWaitlists[JOB_NAME], "completed");
      const queued = await findJobRows(WatchGpuWaitlists[JOB_NAME], { state: "created" });

      if (queued.length) await makeJobDue(WatchGpuWaitlists[JOB_NAME], { state: "created" });
      else await jobQueue.enqueue(new WatchGpuWaitlists(), { singletonKey: WATCH_GPU_WAITLISTS_KEY });

      await vi.waitFor(async () => expect(await countJobs(WatchGpuWaitlists[JOB_NAME], "completed")).toBeGreaterThan(watchesDone), {
        timeout: 20_000,
        interval: 250
      });
      await vi.waitFor(async () => expect(await countJobs(ConfirmGpuPools[JOB_NAME], "active")).toBe(0), { timeout: 20_000, interval: 250 });
    }

    async function waitForNotices(count: number) {
      await vi.waitFor(async () => expect(await countJobs(GpuAvailableNoticeJob[JOB_NAME], "completed")).toBe(count), { timeout: 30_000, interval: 250 });
      await vi.waitFor(() => expect(notifications).toHaveLength(count), { timeout: 10_000, interval: 100 });
    }

    async function rewindPoolClocks(minutes: number) {
      const pools = container.resolve(GpuWaitlistPoolRepository);
      const [pool] = await pools.findByPoolKeys([POOL_KEY]);
      await pools.update(POOL_KEY, { lastCheckAt: subMinutes(pool.lastCheckAt!, minutes), lastRoundAt: subMinutes(pool.lastRoundAt!, minutes) });
    }

    async function leaseOffers({ user, wallet }: Awaited<ReturnType<typeof joinFiveUsers>>[number], leasedFrom: string) {
      const dseq = faker.number.int({ min: 100000, max: 999999 }).toString();
      await seedDeploymentSetting({ userId: user.id, organizationId: wallet.organizationId!, dseq });
      vi.spyOn(container.resolve(LeaseGpuOfferService), "findOffers").mockResolvedValue({
        liveLeases: 1,
        leasesWithoutBid: 0,
        offers: [
          {
            gseq: 1,
            oseq: 1,
            bseq: 0,
            provider: leasedFrom,
            recordedAt: new Date().toISOString(),
            resources: [
              {
                resourceId: 1,
                replicas: 1,
                unitsPerReplica: 8,
                attributes: [{ key: "vendor/nvidia/model/h100/ram/80Gi/interface/sxm", value: "true" }]
              }
            ]
          }
        ]
      });

      await container
        .resolve(JobQueueService)
        .enqueue(new RecordLeaseGpuOffers({ walletId: wallet.id, dseq, leaseCreatedAt: new Date().toISOString() }), { singletonKey: `lease.${dseq}` });
      await expectJobCompleted(RecordLeaseGpuOffers[JOB_NAME], { singletonKey: `lease.${dseq}` });
    }

    return { users, provider, notifications, serveSupply, tickWatcher, waitForNotices, rewindPoolClocks, leaseOffers };
  }

  async function joinFiveUsers() {
    const accounts = [];
    for (let place = 1; place <= 5; place++) {
      accounts.push(await seedUserWithWallet({ isTrialing: false, user: { userId: faker.string.uuid(), email: faker.internet.email() } }));
    }

    const tokens = new Map(accounts.map(({ user }) => [`token-${user.userId}`, user.userId!]));
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );

    const users = [];
    for (const { user, wallet } of accounts) {
      const response = await app.request("/v1/gpu-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer token-${user.userId}` },
        body: JSON.stringify({ data: { vendor: "nvidia", model: "h100", gpuCount: 8, source: "no_bids" } })
      });
      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: { id: string; placeInLine: number } };
      const entry = (await container.resolve(GpuWaitlistEntryRepository).findByIdAcrossOrganizations(data.id))!;
      users.push({ user, wallet, entry });
    }

    return users;
  }

  function fakeSetupCheck(provider: string) {
    vi.spyOn(container.resolve(GpuSetupCheckService), "check").mockImplementation(async setups => ({
      status: "checked",
      results: setups.map(setup => ({ setup, status: "checked", bids: [{ provider, priceUsdPerHour: 2.5 }] }))
    }));
  }

  function inventoryUrl() {
    return container.resolve(DeploymentConfigService).get("PROVIDER_INVENTORY_API_URL");
  }

  function captureNotifications() {
    const notifications: { recipient: string }[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post("/internal/v1/jobs/notification")
      .reply(function reply(_uri, body) {
        notifications.push(body as { recipient: string });
        return [204];
      });

    return notifications;
  }

  async function countJobs(name: string, state: string) {
    return (await findJobRows(name, { state })).length;
  }
});
