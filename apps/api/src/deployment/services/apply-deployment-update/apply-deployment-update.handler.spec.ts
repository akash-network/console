import type { Ability } from "@casl/ability";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { AuthService } from "@src/auth/services/auth.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { failedUpdateActivityOf, updatedActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { ApplyDeploymentUpdateHandler } from "./apply-deployment-update.handler";

describe(ApplyDeploymentUpdateHandler.name, () => {
  const UPDATE = { userId: "user-1", dseq: "100", manifestVersion: "U0FWRUQ=", activityId: "activity-1" };
  const PAYLOAD = { ...UPDATE, version: 1 as const };
  const FIRST_ATTEMPT = { id: "job-1", retryCount: 0, retryLimit: 8 };
  const LAST_ATTEMPT = { id: "job-1", retryCount: 8, retryLimit: 8 };

  it("runs one apply of a deployment at a time, with any newer one queued behind it", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("singleton");
  });

  it("asks only for the right to sign with the user's wallet and to read the user's saved definitions", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { userId: "user-1" } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId: "user-1" } }
    ]);
  });

  it("applies the saved version under the job's ability and records the update as succeeded", async () => {
    const { handler, deploymentWriterService, activityService, ability } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(deploymentWriterService.applySavedPatch).toHaveBeenCalledWith(UPDATE, ability);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", updatedActivityOf(UPDATE));
    expect(deploymentWriterService.applySavedPatch.mock.invocationCallOrder[0]).toBeLessThan(activityService.settle.mock.invocationCallOrder[0]);
  });

  it("leaves an activity that is no longer pending alone", async () => {
    const { handler, deploymentWriterService, activityService } = setup({ pending: false });

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(deploymentWriterService.applySavedPatch).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("leaves a failed attempt with retries to come for the next one to settle", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = new Error("provider unreachable");
    deploymentWriterService.applySavedPatch.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, { ...LAST_ATTEMPT, retryCount: 7 })).rejects.toBe(failure);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records the last failed attempt with its reason", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = createError(400, "Deployment closed");
    deploymentWriterService.applySavedPatch.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedUpdateActivityOf(UPDATE, failure));
  });

  it("records a failure run without retry metadata, which has no attempt to come", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = createError(400, "Deployment closed");
    deploymentWriterService.applySavedPatch.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD)).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedUpdateActivityOf(UPDATE, failure));
  });

  it("keeps a last attempt with an undecided outcome pending under its hash", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const undecided = new TxOutcomeUnknownError("ABCDEF");
    deploymentWriterService.applySavedPatch.mockRejectedValue(undecided);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(undecided);

    expect(activityService.settle).toHaveBeenCalledWith(
      "activity-1",
      expect.objectContaining({ status: "pending", meta: { dseq: "100", manifestVersion: "U0FWRUQ=", txHash: "ABCDEF" } })
    );
  });

  it("never records an applied update as failed when writing its success fails on the last attempt", async () => {
    const { handler, activityService } = setup();
    const writeFailure = new Error("connection terminated");
    activityService.settle.mockRejectedValueOnce(writeFailure);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(writeFailure);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", updatedActivityOf(UPDATE));
  });

  function setup(input?: { pending?: boolean }) {
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.applySavedPatch.mockResolvedValue(undefined);
    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);
    const ability = mock<Ability>();
    const authService = mock<AuthService>({ ability });

    const handler = new ApplyDeploymentUpdateHandler(deploymentWriterService, activityService, authService);

    return { handler, deploymentWriterService, activityService, ability };
  }
});
