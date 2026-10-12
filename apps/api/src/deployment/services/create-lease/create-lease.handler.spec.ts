import type { LoggerService } from "@akashnetwork/logging";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { LeaseService } from "@src/deployment/services/lease/lease.service";
import { createdLeaseActivityOf, failedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { CreateLeaseHandler } from "./create-lease.handler";

describe(CreateLeaseHandler.name, () => {
  const LEASES = [{ dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider" }];
  const PAYLOAD = { userId: "user-1", leases: LEASES, activityId: "activity-1", version: 1 as const };
  const KEY = { userId: "user-1", leases: LEASES };

  it("keeps one lease creation per deployment across queued, retrying and running jobs", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("exclusive");
  });

  it("asks for the right to sign with the user's wallet and to read the user's deployment settings", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { userId: "user-1" } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId: "user-1" } }
    ]);
  });

  it("creates the leases and records them as succeeded", async () => {
    const { handler, leaseService, activityService } = setup();

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 6 });

    expect(leaseService.createQueuedLeases).toHaveBeenCalledWith({ userId: "user-1", leases: LEASES });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdLeaseActivityOf(KEY));
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

  function setup(input?: { pending?: boolean }) {
    const leaseService = mock<LeaseService>();
    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);
    const logger = mock<LoggerService>();
    const createLogger = vi.fn(() => logger);

    const handler = new CreateLeaseHandler(leaseService, activityService, createLogger);

    return { handler, leaseService, activityService, logger, createLogger };
  }
});
