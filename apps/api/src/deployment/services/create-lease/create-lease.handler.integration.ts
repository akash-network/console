import "@src/app/providers/jobs.provider";

import { BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import createError from "http-errors";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type EnqueueOptions, JOB_NAME } from "@src/core";
import { pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { CreateLeaseHandler } from "./create-lease.handler";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor } from "./create-lease.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const HELLO_WORLD_SDL = fs.readFileSync(path.resolve(__dirname, "../../../../test/mocks/hello-world-sdl.yml"), "utf8");

const jobWorkers = useJobWorkers(() => [container.resolve(CreateLeaseHandler)]);

describe(CreateLeaseHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the leases and sends the manifest derived from the stored definition, run the way a worker runs it", async () => {
    const { createInBackground, findActivity, singletonKey, signerService, providerService, wallet } = await setup();

    await createInBackground();

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    expect(providerService.sendManifest).toHaveBeenCalledWith(
      expect.objectContaining({ dseq: expect.any(String), manifest: expect.stringContaining('"name":"web"') })
    );
    expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: wallet.id, provider: expect.any(String) });
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  it("records a refusal on the first attempt as failed with its reason and ends the job", async () => {
    const { createInBackground, findActivity, singletonKey, signerService } = await setup();
    signerService.assertCanBroadcast.mockRejectedValue(createError(402, "Not enough credits to create this lease"));

    await createInBackground();

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "lease_create_failed", message: "Not enough credits to create this lease" } }
    });
  });

  it("records the failure with its reason once the last attempt fails", async () => {
    const { createInBackground, findActivity, waitForJobIn, providerService } = await setup();
    providerService.sendManifest.mockRejectedValue(createError(503, "Provider service is temporarily unavailable"));

    await createInBackground({ retryLimit: 0 });

    await waitForJobIn("failed");
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: { code: "manifest_not_delivered" } } });
  });

  it("keeps the activity pending while the lease still has retries to come", async () => {
    const { createInBackground, findActivity, waitForJobIn, providerService } = await setup();
    providerService.sendManifest.mockRejectedValue(createError(503, "Provider service is temporarily unavailable"));

    await createInBackground({ retryLimit: 3, retryDelay: 3600 });

    await waitForJobIn("retry");
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet, address } = await seedUserWithWallet();
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: wallet.userId, dseq, sdl: HELLO_WORLD_SDL, manifestVersion: "AAAA" });
    const leases = [{ dseq, gseq: 1, oseq: 1, provider: createAkashAddress() }];
    const activity = await activityRepository.create(pendingLeaseActivityOf({ userId: wallet.userId, leases }));
    const singletonKey = createLeaseKeyFor({ owner: address, dseq });

    vi.spyOn(container.resolve(LeaseHttpService), "list").mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    vi.spyOn(container.resolve(BidHttpService), "list").mockResolvedValue([]);
    const signerService = container.resolve(ManagedSignerService);
    vi.spyOn(signerService, "assertCanBroadcast").mockResolvedValue(undefined);
    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({ code: 0, hash: "ABCDEF", transactionHash: "ABCDEF", rawLog: "" });
    const providerService = container.resolve(ProviderService);
    vi.spyOn(providerService, "assertReachable").mockResolvedValue(undefined);
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ type: "jwt", token: "jwt-token" });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);

    return {
      wallet,
      singletonKey,
      signerService: vi.mocked(signerService),
      providerService: vi.mocked(providerService),
      createInBackground: async (retryOverrides: EnqueueOptions = {}) => {
        await enqueue(new CreateLease({ userId: wallet.userId, leases, activityId: activity.id }), {
          singletonKey,
          ...CREATE_LEASE_RETRY_OPTIONS,
          ...retryOverrides
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id),
      waitForJobIn: async (state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(CreateLease[JOB_NAME], { singletonKey });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
  }
});
