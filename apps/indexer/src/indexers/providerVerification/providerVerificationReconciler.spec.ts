import type { ProviderVerificationQueryClient } from "@akashnetwork/provider-verification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ReconcileBlockSource, ReconcileRepository } from "./providerVerificationReconciler";
import { ProviderVerificationReconciler } from "./providerVerificationReconciler";
import type { ClaimedProviderVerificationTarget } from "./providerVerificationRepository";

const block = { height: 200, datetime: new Date("2026-08-24T12:00:00.000Z") };

describe(ProviderVerificationReconciler.name, () => {
  const client = mock<ProviderVerificationQueryClient>();
  const repository = mock<ReconcileRepository>();
  const blockSource = mock<ReconcileBlockSource>();

  beforeEach(() => {
    vi.resetAllMocks();
    blockSource.getLatestProcessedBlock.mockResolvedValue(block);
    repository.hasDiscrepancies.mockResolvedValue(true);
    repository.replaceGlobalState.mockResolvedValue(true);
    repository.replaceProviderState.mockResolvedValue(true);
  });

  it("queues scheduled refreshes without invalidating the currently indexed view", async () => {
    await new ProviderVerificationReconciler(client, repository, blockSource).enqueueFullReconciliation();

    expect(repository.enqueue).toHaveBeenCalledWith({ targetType: "global", targetKey: "*" }, 200, undefined, false);
    expect(repository.enqueueAllProviders).toHaveBeenCalledWith(200, undefined, false);
  });

  it("reconciles a provider at the latest locally processed height", async () => {
    const target = providerTarget();
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    client.getProviderState.mockResolvedValue(emptyProviderState("200"));

    const processed = await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(processed).toBe(1);
    expect(client.getProviderState).toHaveBeenCalledWith("akash1provider", "200");
    expect(repository.replaceProviderState).toHaveBeenCalledWith(expect.objectContaining({ provider: "akash1provider", observedHeight: 200 }));
    expect(repository.complete).toHaveBeenCalledWith(target, 200);
  });

  it("refreshes global records before writing grace references that are not indexed yet", async () => {
    const target = providerTarget();
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    repository.hasDiscrepancies.mockResolvedValue(false);
    client.getProviderState.mockResolvedValue({
      ...emptyProviderState("200"),
      grace: {
        id: 4n,
        provider: "akash1provider",
        preservedTier: 2,
        startedAt: block.datetime,
        expiresAt: new Date("2026-08-25T12:00:00.000Z"),
        sourceDiscrepancyIds: [7n],
        status: 1
      }
    });
    client.getGlobalState.mockResolvedValue({
      observedHeight: "200",
      params: { verificationModuleActive: true } as never,
      auditors: [],
      discrepancies: []
    });

    await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(repository.replaceGlobalState).toHaveBeenCalledBefore(repository.replaceProviderState);
  });

  it("resolves escrow invalidations back to their provider aggregate", async () => {
    const target = { ...providerTarget(), targetType: "audit_escrow" as const, targetKey: "17" };
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    client.getAuditEscrow.mockResolvedValue({ provider: "akash1provider" } as Awaited<ReturnType<ProviderVerificationQueryClient["getAuditEscrow"]>>);
    client.getProviderState.mockResolvedValue(emptyProviderState("200"));

    await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(client.getAuditEscrow).toHaveBeenCalledWith("17", "200");
    expect(client.getProviderState).toHaveBeenCalledWith("akash1provider", "200");
  });

  it("resolves discrepancy invalidations back to their provider aggregate", async () => {
    const target = { ...providerTarget(), targetType: "discrepancy" as const, targetKey: "19" };
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    client.getDiscrepancy.mockResolvedValue({ provider: "akash1provider" } as Awaited<ReturnType<ProviderVerificationQueryClient["getDiscrepancy"]>>);
    client.getGlobalState.mockResolvedValue({
      observedHeight: "200",
      params: { verificationModuleActive: true } as never,
      auditors: [],
      discrepancies: []
    });
    client.getProviderState.mockResolvedValue(emptyProviderState("200"));

    await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(client.getDiscrepancy).toHaveBeenCalledWith("19", "200");
    expect(client.getGlobalState).toHaveBeenCalledWith("200");
    expect(client.getProviderState).toHaveBeenCalledWith("akash1provider", "200");
    expect(repository.replaceGlobalState).toHaveBeenCalledBefore(repository.replaceProviderState);
  });

  it("keeps a failed target for bounded retry", async () => {
    const target = providerTarget();
    const error = new Error("query unavailable");
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    client.getProviderState.mockRejectedValue(error);

    await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(repository.fail).toHaveBeenCalledWith(target, error);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("retries a global target when the canonical params response is incomplete", async () => {
    const target = { ...providerTarget(), targetType: "global" as const, targetKey: "*" };
    repository.claimNext.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    client.getGlobalState.mockResolvedValue({ observedHeight: "200", params: null, auditors: [], discrepancies: [] });

    await new ProviderVerificationReconciler(client, repository, blockSource).runBatch();

    expect(repository.replaceGlobalState).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith(target, expect.objectContaining({ message: "Provider verification params are missing at height 200" }));
  });
});

function providerTarget(): ClaimedProviderVerificationTarget {
  return { targetType: "provider", targetKey: "akash1provider", requestedHeight: 100, attemptCount: 0 };
}

function emptyProviderState(observedHeight: string): Awaited<ReturnType<ProviderVerificationQueryClient["getProviderState"]>> {
  return {
    provider: "akash1provider",
    attestations: [],
    auditEscrows: [],
    bond: null,
    requiredBondForCurrentTier: null,
    grace: null,
    maintenances: [],
    snapshot: null,
    observedHeight
  };
}
