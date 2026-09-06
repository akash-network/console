import type { AuthzHttpService, LeaseHttpService, RpcLease } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import type { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { ABUSE_LOCK_REASON, TrialAbuseEnforcementService } from "./trial-abuse-enforcement.service";

import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

const GRANTER = "akash1funding";
const DETECTION_ID = "detection-1";
const REVOKE_DEPOSIT = mock<ReturnType<RpcMessageService["getRevokeDepositDeploymentGrantMsg"]>>({ typeUrl: "/cosmos.authz.v1beta1.MsgRevoke" });
const REVOKE_FEE = mock<ReturnType<RpcMessageService["getRevokeAllowanceMsg"]>>({ typeUrl: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance" });

describe(TrialAbuseEnforcementService.name, () => {
  it("revokes the deposit grant, closes every live deployment, revokes the fee grant, then locks the wallet, in that order", async () => {
    const { service, wallet, calls, userWalletRepository, detectionRepository, instrumentation } = setup({ liveDseqs: ["11", "22"] });

    const outcome = await service.enforce({ wallet, detectionId: DETECTION_ID });

    expect(calls).toEqual(["cancelProbes", "revoke:deposit", "close:11", "close:22", "revoke:fee", "lock"]);
    expect(userWalletRepository.lockForAbuse).toHaveBeenCalledWith(wallet.id, ABUSE_LOCK_REASON);
    expect(outcome).toEqual({ depositGrantRevoked: true, feeGrantRevoked: true, closedDseqs: ["11", "22"] });
    expect(detectionRepository.updateById).toHaveBeenNthCalledWith(1, DETECTION_ID, {
      action: "enforcing",
      enforcementError: null,
      updatedAt: expect.any(Date)
    });
    expect(detectionRepository.markWalletEnforced).toHaveBeenCalledWith(wallet.id);
    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("enforced");
  });

  it("does not count a wipe that landed as failed when the bookkeeping after the lock throws", async () => {
    const { service, wallet, calls, detectionRepository, instrumentation } = setup({ liveDseqs: [] });
    detectionRepository.markWalletEnforced.mockRejectedValue(new Error("db down"));

    await expect(service.enforce({ wallet, detectionId: DETECTION_ID })).rejects.toThrow("db down");

    expect(calls).toContain("lock");
    expect(detectionRepository.updateById).not.toHaveBeenCalledWith(DETECTION_ID, expect.objectContaining({ action: "enforcement_failed" }));
    expect(instrumentation.recordEnforcement).not.toHaveBeenCalledWith("failed");
  });

  it("skips a revoke the chain no longer holds and tolerates one it reports as already gone", async () => {
    const { service, wallet, signerService, calls } = setup({ liveDseqs: [], hasDepositGrant: false, hasFeeGrant: true });
    signerService.executeFundingTx.mockRejectedValueOnce(new Error("failed to execute message; message index: 0: authorization not found"));

    const outcome = await service.enforce({ wallet, detectionId: DETECTION_ID });

    expect(signerService.executeFundingTx).toHaveBeenCalledTimes(1);
    expect(signerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_FEE]);
    expect(calls).toEqual(["cancelProbes", "lock"]);
    expect(outcome).toEqual({ depositGrantRevoked: false, feeGrantRevoked: true, closedDseqs: [] });
  });

  it("closes each live deployment once even when several leases share it", async () => {
    const { service, wallet, deploymentWriterService } = setup({ liveDseqs: ["11", "11"] });

    await service.enforce({ wallet, detectionId: DETECTION_ID });

    expect(deploymentWriterService.close).toHaveBeenCalledTimes(1);
  });

  it("closes the other deployments, then fails the run when an escrow cannot settle yet, so the queue retries", async () => {
    const { service, wallet, deploymentWriterService, chainErrorService, userWalletRepository, detectionRepository, instrumentation } = setup({
      liveDseqs: ["11", "22"]
    });
    const unsettleable = new Error("escrow settlement underflow");
    deploymentWriterService.close.mockImplementation(async (_wallet, dseq) => {
      if (dseq === "11") throw unsettleable;
      return true;
    });
    chainErrorService.isUnsettleableDeploymentError.mockImplementation(error => error === unsettleable);

    await expect(service.enforce({ wallet, detectionId: DETECTION_ID })).rejects.toThrow(/11 cannot be closed/);

    expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, "22");
    expect(userWalletRepository.lockForAbuse).not.toHaveBeenCalled();
    expect(detectionRepository.updateById).toHaveBeenLastCalledWith(DETECTION_ID, {
      action: "enforcement_failed",
      enforcementError: expect.stringContaining("11 cannot be closed"),
      updatedAt: expect.any(Date)
    });
    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("failed");
  });

  it("leaves the wallet untouched and rethrows when a revoke fails for another reason", async () => {
    const { service, wallet, signerService, userWalletRepository, deploymentWriterService } = setup({ liveDseqs: ["11"] });
    signerService.executeFundingTx.mockRejectedValueOnce(new Error("account sequence mismatch"));

    await expect(service.enforce({ wallet, detectionId: DETECTION_ID })).rejects.toThrow("account sequence mismatch");

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(userWalletRepository.lockForAbuse).not.toHaveBeenCalled();
  });

  function setup(input: { liveDseqs: string[]; hasDepositGrant?: boolean; hasFeeGrant?: boolean }) {
    const wallet = createInitializedUserWallet({ isTrialing: true });
    const calls: string[] = [];

    const txManagerService = mock<TxManagerService>();
    txManagerService.getFundingWalletAddress.mockResolvedValue(GRANTER);
    const authzHttpService = mock<AuthzHttpService>();
    authzHttpService.hasDepositDeploymentGrant.mockResolvedValue(input.hasDepositGrant ?? true);
    authzHttpService.hasFeeAllowance.mockResolvedValue(input.hasFeeGrant ?? true);
    const rpcMessageService = mock<RpcMessageService>();
    rpcMessageService.getRevokeDepositDeploymentGrantMsg.mockReturnValue(REVOKE_DEPOSIT);
    rpcMessageService.getRevokeAllowanceMsg.mockReturnValue(REVOKE_FEE);
    const signerService = mock<ManagedSignerService>();
    signerService.executeFundingTx.mockImplementation(async messages => {
      calls.push(messages[0] === REVOKE_DEPOSIT ? "revoke:deposit" : "revoke:fee");
      return mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>();
    });
    const leaseHttpService = mock<LeaseHttpService>();
    leaseHttpService.list.mockImplementation(async ({ state }) => ({
      leases: state === "active" ? input.liveDseqs.map(dseq => mock<RpcLease>({ lease: { id: { dseq } } })) : [],
      pagination: { next_key: null, total: "0" }
    }));
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.close.mockImplementation(async (_wallet, dseq) => {
      calls.push(`close:${dseq}`);
      return true;
    });
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(false);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.lockForAbuse.mockImplementation(async () => {
      calls.push("lock");
    });
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    const probeJobService = mock<TrialWorkloadProbeJobService>();
    probeJobService.cancelForWallet.mockImplementation(async () => {
      calls.push("cancelProbes");
      return 0;
    });
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TrialAbuseEnforcementService(
      txManagerService,
      authzHttpService,
      rpcMessageService,
      signerService,
      leaseHttpService,
      deploymentWriterService,
      chainErrorService,
      userWalletRepository,
      detectionRepository,
      probeJobService,
      instrumentation,
      createLogger
    );

    return {
      service,
      wallet,
      calls,
      signerService,
      deploymentWriterService,
      chainErrorService,
      userWalletRepository,
      detectionRepository,
      instrumentation,
      logger
    };
  }
});
