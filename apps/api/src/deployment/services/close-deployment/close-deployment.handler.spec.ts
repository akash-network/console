import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { WalletInitialized } from "@src/billing/repositories";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { closedActivityOf, failedCloseActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseDeploymentHandler } from "./close-deployment.handler";

describe(CloseDeploymentHandler.name, () => {
  const PAYLOAD = { userId: "user-1", dseq: "100", activityId: "activity-1", version: 1 as const };
  const KEY = { userId: "user-1", dseq: "100" };

  it("keeps one close per deployment across queued, retrying and running jobs", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("exclusive");
  });

  it("asks only for the right to sign with the wallet of the user who asked for the close", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([{ action: "sign", subject: "UserWallet", conditions: { userId: "user-1" } }]);
  });

  it("closes the deployment and records the close as succeeded", async () => {
    const { handler, walletReaderService, deploymentWriterService, activityService, wallet } = setup();

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 8 });

    expect(walletReaderService.getWalletByUserId).toHaveBeenCalledWith("user-1");
    expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, "100");
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf(KEY));
  });

  it("records the close as succeeded when the deployment had already been closed", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    deploymentWriterService.close.mockResolvedValue(false);

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 8 });

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf(KEY));
  });

  it("keeps the bulk close it was part of when the close succeeds", async () => {
    const { handler, activityService } = setup();

    await handler.handle({ ...PAYLOAD, batchId: "batch-1" }, { id: "job-1", retryCount: 0, retryLimit: 8 });

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf({ ...KEY, batchId: "batch-1" }));
  });

  it("keeps the bulk close it was part of when the last attempt fails", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = createError(400, "Deployment is not open");
    deploymentWriterService.close.mockRejectedValue(failure);

    await expect(handler.handle({ ...PAYLOAD, batchId: "batch-1" }, { id: "job-1", retryCount: 8, retryLimit: 8 })).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedCloseActivityOf({ ...KEY, batchId: "batch-1" }, failure));
  });

  it("leaves an activity that is no longer pending alone", async () => {
    const { handler, deploymentWriterService, activityService } = setup({ pending: false });

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 0, retryLimit: 8 });

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("leaves a failed attempt with retries to come for the next one to settle", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = new Error("node unreachable");
    deploymentWriterService.close.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 7, retryLimit: 8 })).rejects.toBe(failure);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records the last failed attempt with its reason", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = createError(402, "Not enough credits to close this deployment");
    deploymentWriterService.close.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 8, retryLimit: 8 })).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedCloseActivityOf(KEY, failure));
  });

  it("never records a close that went through as failed when writing its success fails on the last attempt", async () => {
    const { handler, activityService } = setup();
    const writeFailure = new Error("connection terminated");
    activityService.settle.mockRejectedValueOnce(writeFailure);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 8, retryLimit: 8 })).rejects.toBe(writeFailure);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf(KEY));
  });

  it("keeps a last attempt with an undecided outcome pending under its hash", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const undecided = new TxOutcomeUnknownError("ABCDEF");
    deploymentWriterService.close.mockRejectedValue(undecided);

    await expect(handler.handle(PAYLOAD, { id: "job-1", retryCount: 8, retryLimit: 8 })).rejects.toBe(undecided);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", expect.objectContaining({ status: "pending", meta: { dseq: "100", txHash: "ABCDEF" } }));
  });

  function setup(input?: { pending?: boolean }) {
    const wallet = mock<WalletInitialized>({ userId: "user-1", address: "akash1owner" });
    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.close.mockResolvedValue(true);
    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);

    const handler = new CloseDeploymentHandler(walletReaderService, deploymentWriterService, activityService);

    return { handler, walletReaderService, deploymentWriterService, activityService, wallet };
  }
});
