import type { LoggerService } from "@akashnetwork/logging";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LeaseService } from "@src/deployment/services/lease/lease.service";
import { createdLeaseActivityOf, failedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { CreateLeaseHandler } from "./create-lease.handler";

import { createInitializedUserWallet, createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(CreateLeaseHandler.name, () => {
  const LEASES = [{ dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider" }];
  const PAYLOAD = { userId: "user-1", walletId: 7, leases: LEASES, activityId: "activity-1", version: 1 as const };
  const TEAM_PAYLOAD = { ...PAYLOAD, walletId: 8, organizationId: "team-org-1" };
  const KEY = { userId: "user-1", leases: LEASES };

  it("keeps one lease creation per deployment across queued, retrying and running jobs", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("exclusive");
  });

  it("asks for the right to sign with the wallet the request resolved and to read the user's settings of the deployment", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { id: 7 } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId: "user-1", dseq: "100" } }
    ]);
  });

  it("asks to read a team wallet's deployment where its organization files it, whichever member filed it", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(TEAM_PAYLOAD)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { id: 8 } },
      { action: "read", subject: "DeploymentSetting", conditions: { organizationId: "team-org-1", dseq: "100" } }
    ]);
  });

  it("creates the leases with the wallet the request resolved and records them as succeeded", async () => {
    const wallet = createInitializedUserWallet({ id: 7, userId: "user-1" });
    const { handler, walletReaderService, leaseService, activityService } = setup({ wallet });

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 });

    expect(walletReaderService.getWalletById).toHaveBeenCalledWith(7);
    expect(leaseService.createQueuedLeases).toHaveBeenCalledWith({ wallet, userId: "user-1" }, LEASES);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdLeaseActivityOf(KEY));
  });

  it("creates a team wallet's leases with that wallet for the member who asked, settling the activity in that member's feed", async () => {
    const teamWallet = createOrganizationWallet({ id: 8, organizationId: "team-org-1" });
    const { handler, walletReaderService, leaseService, activityService } = setup({ wallet: teamWallet });

    await handler.handle(TEAM_PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 });

    expect(walletReaderService.getWalletById).toHaveBeenCalledWith(8);
    expect(leaseService.createQueuedLeases).toHaveBeenCalledWith({ wallet: teamWallet, userId: "user-1" }, LEASES);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", expect.objectContaining({ userId: "user-1", status: "succeeded" }));
  });

  it.each([
    { attempt: "the first attempt", retryCount: 0 },
    { attempt: "a retry", retryCount: 3 }
  ])("records a wallet it may no longer sign with as failed on $attempt and ends the job", async ({ retryCount }) => {
    const { handler, walletReaderService, leaseService, activityService, logger } = setup();
    const missing = createError(404, "UserWallet Not Found");
    walletReaderService.getWalletById.mockRejectedValue(missing);

    await handler.handle(PAYLOAD, { id: "job-1", retryCount, retryLimit: 6 });

    expect(leaseService.createQueuedLeases).not.toHaveBeenCalled();
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, missing));
    expect(logger.warn).toHaveBeenCalledWith({ event: "BACKGROUND_LEASE_REFUSED", activityId: "activity-1", dseq: "100", error: missing });
  });

  it.each([
    { failure: "a server error", error: createError(500, "Failed query") },
    { failure: "a failure that is not an http error", error: new Error("connection terminated") }
  ])("keeps the activity pending and retries a wallet read that failed with $failure while attempts remain", async ({ error }) => {
    const { handler, walletReaderService, leaseService, activityService } = setup();
    walletReaderService.getWalletById.mockRejectedValue(error);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 })).rejects.toBe(error);

    expect(leaseService.createQueuedLeases).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records a wallet read that still fails on the last attempt and still fails the job", async () => {
    const { handler, walletReaderService, activityService } = setup();
    const failure = new Error("connection terminated");
    walletReaderService.getWalletById.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 6, retryLimit: 6 })).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, failure));
  });

  it("does nothing once the activity has settled", async () => {
    const { handler, leaseService, activityService } = setup({ pending: false });

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 });

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(leaseService.createQueuedLeases).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records a refusal on the first attempt as failed at once and ends the job", async () => {
    const { handler, leaseService, activityService, logger } = setup();
    const refusal = createError(400, "The selected bid is no longer open");
    leaseService.createQueuedLeases.mockRejectedValue(refusal);

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 });

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, refusal));
    expect(logger.warn).toHaveBeenCalledWith({ event: "BACKGROUND_LEASE_REFUSED", activityId: "activity-1", dseq: "100", error: refusal });
  });

  it.each([
    { failure: "a refusal after an earlier attempt failed", error: createError(400, "The selected bid is no longer open"), retryCount: 1 },
    { failure: "a gateway error", error: createError(502, "unreachable", { errorCode: "provider_unreachable" }), retryCount: 0 },
    { failure: "a server error", error: createError(500, "Deployment could not be read, please retry"), retryCount: 0 },
    { failure: "an undecided outcome", error: new TxOutcomeUnknownError("ABCDEF"), retryCount: 0 },
    {
      failure: "a manifest the provider refused, since its lease exists",
      error: createError(400, "rejected", { errorCode: "manifest_not_delivered" }),
      retryCount: 0
    },
    { failure: "a failure that is not an http error", error: new Error("socket hang up"), retryCount: 0 }
  ])("keeps the activity pending and retries $failure while attempts remain", async ({ error, retryCount }) => {
    const { handler, leaseService, activityService } = setup();
    leaseService.createQueuedLeases.mockRejectedValue(error);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount, retryLimit: 6 })).rejects.toBe(error);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records the failure on the last attempt and still fails the job", async () => {
    const { handler, leaseService, activityService } = setup();
    const failure = createError(400, "rejected", { errorCode: "manifest_not_delivered" });
    leaseService.createQueuedLeases.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 6, retryLimit: 6 })).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, failure));
  });

  it("leaves a lease still undecided on the last attempt pending under its hash", async () => {
    const { handler, leaseService, activityService } = setup();
    const undecided = new TxOutcomeUnknownError("ABCDEF");
    leaseService.createQueuedLeases.mockRejectedValue(undecided);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 6, retryLimit: 6 })).rejects.toBe(undecided);

    expect(activityService.settle).toHaveBeenCalledWith(
      "activity-1",
      expect.objectContaining({ status: "pending", meta: expect.objectContaining({ txHash: "ABCDEF" }) })
    );
  });

  it("records a refusal as failed when run outside a worker", async () => {
    const { handler, leaseService, activityService } = setup();
    const refusal = createError(400, "The selected bid is no longer open");
    leaseService.createQueuedLeases.mockRejectedValue(refusal);

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, refusal));
  });

  it("treats a run outside a worker as its last attempt", async () => {
    const { handler, leaseService, activityService } = setup();
    const failure = new Error("socket hang up");
    leaseService.createQueuedLeases.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD)).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedLeaseActivityOf(KEY, failure));
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: CreateLeaseHandler.name });
  });

  function setup(input?: { pending?: boolean; wallet?: ReturnType<typeof createInitializedUserWallet> | ReturnType<typeof createOrganizationWallet> }) {
    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletById.mockResolvedValue(input?.wallet ?? createInitializedUserWallet({ id: 7, userId: "user-1" }));
    const leaseService = mock<LeaseService>();
    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);
    const logger = mock<LoggerService>();
    const createLogger = vi.fn(() => logger);

    const handler = new CreateLeaseHandler(walletReaderService, leaseService, activityService, createLogger);

    return { handler, walletReaderService, leaseService, activityService, logger, createLogger };
  }
});
