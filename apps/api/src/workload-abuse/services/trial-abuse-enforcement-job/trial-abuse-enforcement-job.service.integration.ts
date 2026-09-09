import { addHours, subMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import {
  EnforceTrialAbuse,
  EnforceTrialAbuseHandler,
  enforceTrialAbuseKeyFor
} from "@src/workload-abuse/services/enforce-trial-abuse/enforce-trial-abuse.handler";
import { ABUSE_LOCK_REASON } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialAbuseEnforcementJobService } from "./trial-abuse-enforcement-job.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const STALLED_MINUTES_AGO = 90;
const RECENT_MINUTES_AGO = 10;

const jobWorkers = useJobWorkers(() => [container.resolve(EnforceTrialAbuseHandler)]);

describe(TrialAbuseEnforcementJobService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues the wipe again for a trial wallet whose enforcement failed or died more than an hour ago", async () => {
    const { reconcile, seedDetection, findEnforcementJob } = await setup({ mode: "enforce" });
    const failed = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO });
    const died = await seedDetection({ action: "enforcing", minutesAgo: STALLED_MINUTES_AGO });
    const stillRetrying = await seedDetection({ action: "enforcement_failed", minutesAgo: RECENT_MINUTES_AGO });
    const done = await seedDetection({ action: "enforced", minutesAgo: STALLED_MINUTES_AGO });

    await reconcile();

    expect(await findEnforcementJob(failed.walletId)).toMatchObject({ state: "created", data: { walletId: failed.walletId, detectionId: failed.id } });
    expect(await findEnforcementJob(died.walletId)).toMatchObject({ state: "created", data: { walletId: died.walletId, detectionId: died.id } });
    expect(await findEnforcementJob(stillRetrying.walletId)).toBeUndefined();
    expect(await findEnforcementJob(done.walletId)).toBeUndefined();
  });

  it("leaves a wallet that has paid or is already locked alone", async () => {
    const { reconcile, seedDetection, findEnforcementJob } = await setup({ mode: "enforce" });
    const paid = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO, wallet: { isTrialing: false } });
    const locked = await seedDetection({
      action: "enforcement_failed",
      minutesAgo: STALLED_MINUTES_AGO,
      wallet: { abuseLockedAt: new Date(), abuseLockedReason: ABUSE_LOCK_REASON }
    });

    await reconcile();

    expect(await findEnforcementJob(paid.walletId)).toBeUndefined();
    expect(await findEnforcementJob(locked.walletId)).toBeUndefined();
  });

  it("queues one wipe per wallet, naming its latest detection", async () => {
    const { reconcile, seedDetection, findEnforcementJobs } = await setup({ mode: "enforce" });
    const older = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO * 2 });
    const latest = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO, walletId: older.walletId });

    await reconcile();

    const jobs = await findEnforcementJobs(older.walletId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toEqual({ walletId: older.walletId, detectionId: latest.id, version: 1 });
  });

  it("does not queue a second wipe while one is still pending for the wallet", async () => {
    const { reconcile, seedDetection, enqueuePending, findEnforcementJobs } = await setup({ mode: "enforce" });
    const stalled = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO });
    await enqueuePending(stalled.walletId, stalled.id);

    await reconcile();

    expect(await findEnforcementJobs(stalled.walletId)).toHaveLength(1);
  });

  it("queues nothing in detect mode", async () => {
    const { reconcile, seedDetection, findEnforcementJob } = await setup({ mode: "detect" });
    const stalled = await seedDetection({ action: "enforcement_failed", minutesAgo: STALLED_MINUTES_AGO });

    await reconcile();

    expect(await findEnforcementJob(stalled.walletId)).toBeUndefined();
  });

  async function setup(input: { mode: "detect" | "enforce" }) {
    const { enqueue } = await jobWorkers();
    const detectionRepository = container.resolve(WorkloadAbuseDetectionRepository);
    const config = container.resolve(WorkloadAbuseConfigService);
    const readConfig = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation(key => (key === "WORKLOAD_ABUSE_ENFORCEMENT_MODE" ? input.mode : readConfig(key)));

    async function seedDetection(detection: {
      action: "enforcing" | "enforced" | "enforcement_failed";
      minutesAgo: number;
      walletId?: number;
      wallet?: { isTrialing?: boolean; abuseLockedAt?: Date; abuseLockedReason?: string };
    }) {
      const seeded = detection.walletId ? undefined : await seedUserWithWallet({ isTrialing: true, ...detection.wallet });
      const walletId = detection.walletId ?? seeded!.wallet.id;
      const userId = seeded?.user.id ?? (await detectionRepository.findOneBy({ walletId }))!.userId;

      return await detectionRepository.create({
        userId,
        walletId,
        dseq: String(Date.now()),
        provider: createAkashAddress(),
        verdict: "hard",
        probeStatus: "probed",
        signals: [],
        evidenceExcerpt: "",
        action: detection.action,
        updatedAt: subMinutes(new Date(), detection.minutesAgo)
      });
    }

    async function findEnforcementJobs(walletId: number) {
      return await findJobRows(EnforceTrialAbuse[JOB_NAME], { singletonKey: enforceTrialAbuseKeyFor(walletId) });
    }

    return {
      reconcile: () => container.resolve(TrialAbuseEnforcementJobService).reconcile({ dryRun: false }),
      seedDetection,
      enqueuePending: (walletId: number, detectionId: string) =>
        enqueue(new EnforceTrialAbuse({ walletId, detectionId }), { singletonKey: enforceTrialAbuseKeyFor(walletId), startAfter: addHours(new Date(), 1) }),
      findEnforcementJobs,
      findEnforcementJob: async (walletId: number) => (await findEnforcementJobs(walletId))[0]
    };
  }
});
