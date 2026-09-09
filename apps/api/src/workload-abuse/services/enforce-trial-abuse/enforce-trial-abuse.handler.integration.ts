import { AuthzHttpService, LeaseHttpService, type RpcLease } from "@akashnetwork/http-sdk";
import { addHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { ProbeTrialDeploymentHandler } from "@src/workload-abuse/services/probe-trial-deployment/probe-trial-deployment.handler";
import { ABUSE_LOCK_REASON } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import { ProbeTrialDeployment, probeTrialDeploymentKeyFor } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { EnforceTrialAbuse, EnforceTrialAbuseHandler, enforceTrialAbuseKeyFor } from "./enforce-trial-abuse.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(EnforceTrialAbuseHandler), container.resolve(ProbeTrialDeploymentHandler)]);

describe(EnforceTrialAbuseHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wipes a trial wallet the way a worker runs it: revokes both grants, closes its deployments, locks the wallet and cancels its probes", async () => {
    const { wallet, detection, close, executeFundingTx, enqueueEnforcement, startWorkers, findWallet, findDetection, findProbeJob } = await setup({
      liveDseqs: ["11"]
    });

    await enqueueEnforcement(detection.id);
    await startWorkers();

    await expectJobCompleted(EnforceTrialAbuse[JOB_NAME], { singletonKey: enforceTrialAbuseKeyFor(wallet.id) });
    expect(await findWallet()).toMatchObject({ deploymentAllowance: 0, feeAllowance: 0, isTrialing: false, abuseLockedReason: ABUSE_LOCK_REASON });
    expect((await findWallet())?.abuseLockedAt).toBeInstanceOf(Date);
    expect((await findDetection(detection.id))?.action).toBe("enforced");
    expect((await findProbeJob("11"))?.state).toBe("cancelled");
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id }), "11");
    expect(executeFundingTx).toHaveBeenCalledTimes(2);
  });

  it("settles every confirmed detection of the wallet, not only the one that triggered the wipe", async () => {
    const { handler, wallet, detection, createDetection, findDetection } = await setup({ liveDseqs: ["11", "22"] });
    const otherDetection = await createDetection("22");

    await handler.handle({ walletId: wallet.id, detectionId: detection.id, version: 1 });

    expect((await findDetection(detection.id))?.action).toBe("enforced");
    expect((await findDetection(otherDetection.id))?.action).toBe("enforced");
  });

  it("settles the detection without touching the chain when the wallet is already locked", async () => {
    const { handler, wallet, detection, close, executeFundingTx, findWallet, findDetection } = await setup({ abuseLockedAt: new Date() });

    await handler.handle({ walletId: wallet.id, detectionId: detection.id, version: 1 });

    expect((await findDetection(detection.id))?.action).toBe("enforced");
    expect((await findWallet())?.deploymentAllowance).toBe(10_000_000);
    expect(close).not.toHaveBeenCalled();
    expect(executeFundingTx).not.toHaveBeenCalled();
  });

  it("leaves a wallet that has since paid alone", async () => {
    const { handler, wallet, detection, close, executeFundingTx, findWallet, findDetection } = await setup({ isTrialing: false });

    await handler.handle({ walletId: wallet.id, detectionId: detection.id, version: 1 });

    expect((await findDetection(detection.id))?.action).toBe("detected");
    expect(await findWallet()).toMatchObject({ abuseLockedAt: null, deploymentAllowance: 10_000_000, isTrialing: false });
    expect(close).not.toHaveBeenCalled();
    expect(executeFundingTx).not.toHaveBeenCalled();
  });

  it("waits for a payment holding the wallet row and leaves the wallet alone once that payment has ended its trial", async () => {
    const { handler, wallet, detection, close, executeFundingTx, findWallet, findDetection, holdWalletRowUntil } = await setup({ liveDseqs: ["11"] });
    let wipe: Promise<void> | undefined;

    await holdWalletRowUntil(async ({ wipeWaitsForRow, endTrial }) => {
      wipe = handler.handle({ walletId: wallet.id, detectionId: detection.id, version: 1 });
      await wipeWaitsForRow;
      await endTrial();
    });
    await wipe;

    expect(await findDetection(detection.id)).toMatchObject({ action: "detected", enforcementError: null });
    expect(await findWallet()).toMatchObject({ abuseLockedAt: null, isTrialing: false, deploymentAllowance: 10_000_000 });
    expect(close).not.toHaveBeenCalled();
    expect(executeFundingTx).not.toHaveBeenCalled();
  });

  it("records the failure on the detection and keeps the wallet unlocked and monitored when a revoke fails", async () => {
    const { handler, wallet, detection, findWallet, findDetection, findProbeJob } = await setup({
      liveDseqs: ["11"],
      revokeError: new Error("account sequence mismatch")
    });

    await expect(handler.handle({ walletId: wallet.id, detectionId: detection.id, version: 1 })).rejects.toThrow("account sequence mismatch");

    expect(await findDetection(detection.id)).toMatchObject({ action: "enforcement_failed", enforcementError: "account sequence mismatch" });
    expect(await findWallet()).toMatchObject({ abuseLockedAt: null, isTrialing: true });
    expect((await findProbeJob("11"))?.state).toBe("created");
  });

  async function setup(input: { isTrialing?: boolean; abuseLockedAt?: Date; liveDseqs?: string[]; revokeError?: Error } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const userWalletRepository = container.resolve(UserWalletRepository);
    const detectionRepository = container.resolve(WorkloadAbuseDetectionRepository);
    const liveDseqs = input.liveDseqs ?? [];

    const { user, wallet } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? true,
      abuseLockedAt: input.abuseLockedAt ?? null,
      abuseLockedReason: input.abuseLockedAt ? ABUSE_LOCK_REASON : null
    });

    async function createDetection(dseq: string) {
      return await detectionRepository.create({
        userId: user.id,
        walletId: wallet.id,
        dseq,
        provider: createAkashAddress(),
        verdict: "hard",
        probeStatus: "probed",
        signals: [],
        evidenceExcerpt: "",
        action: "detected"
      });
    }

    const detection = await createDetection(liveDseqs[0] ?? "11");

    for (const dseq of liveDseqs) {
      await enqueue(new ProbeTrialDeployment({ walletId: wallet.id, dseq, attempt: 1, leaseCreatedAt: new Date().toISOString() }), {
        singletonKey: probeTrialDeploymentKeyFor({ walletId: wallet.id, dseq }),
        startAfter: addHours(new Date(), 1)
      });
    }

    vi.spyOn(container.resolve(TxManagerService), "getFundingWalletAddress").mockResolvedValue(createAkashAddress());
    vi.spyOn(container.resolve(AuthzHttpService), "hasDepositDeploymentGrant").mockResolvedValue(true);
    vi.spyOn(container.resolve(AuthzHttpService), "hasFeeAllowance").mockResolvedValue(true);
    vi.spyOn(container.resolve(LeaseHttpService), "list").mockImplementation(async ({ state }) => ({
      leases: state === "active" ? liveDseqs.map(dseq => mock<RpcLease>({ lease: { id: { dseq } } })) : [],
      pagination: { next_key: null, total: "0" }
    }));
    const executeFundingTx = vi.spyOn(container.resolve(ManagedSignerService), "executeFundingTx");
    if (input.revokeError) executeFundingTx.mockRejectedValue(input.revokeError);
    else executeFundingTx.mockResolvedValue(mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>());
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);

    async function holdWalletRowUntil(cb: (payment: { wipeWaitsForRow: Promise<void>; endTrial: () => Promise<void> }) => Promise<void>) {
      const userWallets = resolveTable("UserWallets");
      const lockWalletRow = userWalletRepository.findOneByAndLock.bind(userWalletRepository);
      const wipeWaitsForRow = new Promise<void>(resolve => {
        vi.spyOn(userWalletRepository, "findOneByAndLock").mockImplementation(async query => {
          resolve();
          return await lockWalletRow(query);
        });
      });

      await container.resolve<ApiPgDatabase>(POSTGRES_DB).transaction(async tx => {
        await tx.select().from(userWallets).where(eq(userWallets.id, wallet.id)).for("update");
        await cb({
          wipeWaitsForRow,
          endTrial: async () => {
            await tx.update(userWallets).set({ isTrialing: false }).where(eq(userWallets.id, wallet.id));
          }
        });
      });
    }

    return {
      holdWalletRowUntil,
      handler: container.resolve(EnforceTrialAbuseHandler),
      wallet,
      detection,
      close,
      executeFundingTx,
      createDetection,
      startWorkers,
      enqueueEnforcement: (detectionId: string) =>
        enqueue(new EnforceTrialAbuse({ walletId: wallet.id, detectionId }), { singletonKey: enforceTrialAbuseKeyFor(wallet.id) }),
      findWallet: () => userWalletRepository.findById(wallet.id),
      findDetection: (id: string) => detectionRepository.findById(id),
      findProbeJob: async (dseq: string) => {
        const [row] = await findJobRows(ProbeTrialDeployment[JOB_NAME], { singletonKey: probeTrialDeploymentKeyFor({ walletId: wallet.id, dseq }) });

        return row;
      }
    };
  }
});
