import "@src/app/providers/jobs.provider";

import { BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { eq } from "drizzle-orm";
import createError from "http-errors";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type ApiPgDatabase, type EnqueueOptions, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { CreateLeaseHandler } from "./create-lease.handler";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor, leaseWalletRefOf } from "./create-lease.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
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
    expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id }), expect.any(Array), {
      actingUserId: wallet.userId
    });
    expect(providerService.sendManifest).toHaveBeenCalledWith(
      expect.objectContaining({ dseq: expect.any(String), manifest: expect.stringContaining('"name":"web"') })
    );
    expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: wallet.id, provider: expect.any(String) });
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  it("creates a team wallet's leases with that wallet for the member who asked, from the definition another member filed", async () => {
    const { createInBackground, findActivity, singletonKey, signerService, providerService, wallet, member } = await setup({ inTeam: true });

    await createInBackground();

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, userId: null }), expect.any(Array), {
      actingUserId: member.userId
    });
    expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: expect.stringContaining('"name":"web"') }));
    expect(await findActivity()).toMatchObject({ userId: member.userId, status: "succeeded" });
  });

  it("records a refusal on the first attempt as failed with its reason and ends the job", async () => {
    const { createInBackground, findActivity, singletonKey, signerService } = await setup();
    signerService.assertCanBroadcastByUserWallet.mockRejectedValue(createError(402, "Not enough credits to create this lease"));

    await createInBackground();

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "lease_create_failed", message: "Not enough credits to create this lease" } }
    });
  });

  it("records a team wallet the job may no longer sign with as failed on a retry and ends the job", async () => {
    const { createInBackground, findActivity, singletonKey, signerService, wallet } = await setup({ inTeam: true });
    vi.spyOn(WalletReaderService.prototype, "getWalletById").mockRejectedValueOnce(new Error("connection terminated"));
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .delete(resolveTable("UserWallets"))
      .where(eq(resolveTable("UserWallets").id, wallet.id));

    await createInBackground({ retryDelay: 1, retryDelayMax: 2 });

    const job = await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(job.retry_count).toBe(1);
    expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: { message: "UserWallet Not Found" } } });
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

  async function setup(input: { inTeam?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet: member } = await seedUserWithWallet();
    const team = input.inTeam ? await seedTeamWalletFor(member.userId) : undefined;
    const wallet = team?.wallet ?? member;
    const dseq = createDseq();
    await seedDeploymentSetting({
      userId: team?.filerId ?? member.userId,
      organizationId: team?.wallet.organizationId,
      dseq,
      sdl: HELLO_WORLD_SDL,
      manifestVersion: "AAAA"
    });
    const leases = [{ dseq, gseq: 1, oseq: 1, provider: createAkashAddress() }];
    const activity = await activityRepository.create(pendingLeaseActivityOf({ userId: member.userId, leases }));
    const singletonKey = createLeaseKeyFor({ owner: wallet.address!, dseq });

    vi.spyOn(container.resolve(LeaseHttpService), "list").mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    vi.spyOn(container.resolve(BidHttpService), "list").mockResolvedValue([]);
    const signerService = container.resolve(ManagedSignerService);
    vi.spyOn(signerService, "assertCanBroadcastByUserWallet").mockResolvedValue(undefined);
    vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValue({ code: 0, hash: "ABCDEF", transactionHash: "ABCDEF", rawLog: "" });
    const providerService = container.resolve(ProviderService);
    vi.spyOn(providerService, "assertReachable").mockResolvedValue(undefined);
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ type: "jwt", token: "jwt-token" });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);

    return {
      wallet,
      member,
      singletonKey,
      signerService: vi.mocked(signerService),
      providerService: vi.mocked(providerService),
      createInBackground: async (retryOverrides: EnqueueOptions = {}) => {
        await enqueue(new CreateLease({ userId: member.userId, ...leaseWalletRefOf(wallet), leases, activityId: activity.id }), {
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

  async function seedTeamWalletFor(memberId: string) {
    const { organization, user: filer } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: organization.id, userId: memberId });
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();

    return { wallet, filerId: filer.id };
  }
});
