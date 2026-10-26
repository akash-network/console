import type { Ability } from "@casl/ability";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { AuthService } from "@src/auth/services/auth.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import {
  ACCESS_REVOKED_ERROR_CODE,
  type MemberDeploymentAccessService
} from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { failedUpdateActivityOf, updatedActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { ApplyDeploymentUpdateHandler } from "./apply-deployment-update.handler";

describe(ApplyDeploymentUpdateHandler.name, () => {
  const UPDATE = { userId: "user-1", dseq: "100", manifestVersion: "U0FWRUQ=" };
  const SAVED = { ...UPDATE, walletId: 7 };
  const PAYLOAD = { ...SAVED, organizationId: "organization-1", activityId: "activity-1", version: 1 as const };
  const FIRST_ATTEMPT = { id: "job-1", retryCount: 0, retryLimit: 8 };
  const LAST_ATTEMPT = { id: "job-1", retryCount: 8, retryLimit: 8 };
  const ACCESS_REVOKED = createError(403, "You no longer have access to this deployment.", { errorCode: ACCESS_REVOKED_ERROR_CODE });

  it("runs one apply of a deployment at a time, with any newer one queued behind it", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("singleton");
  });

  it("asks only for the right to sign with the wallet the request resolved and to read the definitions of the deployment's organization", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { id: 7 } },
      { action: "read", subject: "DeploymentSetting", conditions: { organizationId: "organization-1" } }
    ]);
  });

  it("reads only the user's own definitions for a deployment filed before organizations", () => {
    const { handler } = setup();
    const { organizationId: _organizationId, ...unfiledPayload } = PAYLOAD;

    expect(handler.requiresPermission(unfiledPayload)).toEqual([
      { action: "sign", subject: "UserWallet", conditions: { id: 7 } },
      { action: "read", subject: "DeploymentSetting", conditions: { userId: "user-1" } }
    ]);
  });

  it("applies the saved version under the job's ability and records the update as succeeded", async () => {
    const { handler, deploymentWriterService, activityService, ability } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(deploymentWriterService.applySavedPatch).toHaveBeenCalledWith(SAVED, ability, { assertMayStillSign: expect.any(Function) });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", updatedActivityOf(UPDATE));
    expect(deploymentWriterService.applySavedPatch.mock.invocationCallOrder[0]).toBeLessThan(activityService.settle.mock.invocationCallOrder[0]);
  });

  it("has the writer check, before it signs, that the member who saved the update may still sign with its wallet", async () => {
    const { handler, deploymentWriterService, memberDeploymentAccessService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(memberDeploymentAccessService.assertMayStillSign).not.toHaveBeenCalled();
    const [[, , { assertMayStillSign }]] = deploymentWriterService.applySavedPatch.mock.calls as [
      [unknown, unknown, { assertMayStillSign: () => Promise<void> }]
    ];
    await assertMayStillSign();
    expect(memberDeploymentAccessService.assertMayStillSign).toHaveBeenCalledWith({ userId: "user-1", walletId: 7, dseq: "100" });
  });

  it.each([FIRST_ATTEMPT, LAST_ATTEMPT])("settles an update the member lost access to as failed without a retry, on attempt $retryCount", async attempt => {
    const { handler, deploymentWriterService, activityService } = setup();
    deploymentWriterService.applySavedPatch.mockRejectedValue(ACCESS_REVOKED);

    await expect(handler.handle(PAYLOAD, attempt)).resolves.toBeUndefined();

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_update",
      status: "failed",
      initiator: "user",
      dedupeKey: null,
      meta: { dseq: "100", manifestVersion: "U0FWRUQ=", error: { code: "access_revoked", message: "You no longer have access to this deployment." } }
    });
  });

  it("settles an update whose manifest the provider refused as invalid as failed without a retry", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const message = "Provider akash1provider refused the manifest (invalid manifest: zero global services). Sending it again cannot help.";
    deploymentWriterService.applySavedPatch.mockRejectedValue(createError(422, message, { errorCode: "provider_manifest_invalid" }));

    await expect(handler.handle(PAYLOAD, FIRST_ATTEMPT)).resolves.toBeUndefined();

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith(
      "activity-1",
      expect.objectContaining({ status: "failed", meta: { dseq: "100", manifestVersion: "U0FWRUQ=", error: { code: "provider_manifest_invalid", message } } })
    );
  });

  it("retries a refusal other than lost access while attempts remain", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const refusal = createError(403, "Forbidden");
    deploymentWriterService.applySavedPatch.mockRejectedValue(refusal);

    await expect(handler.handle(PAYLOAD, FIRST_ATTEMPT)).rejects.toBe(refusal);

    expect(activityService.settle).not.toHaveBeenCalled();
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
    const memberDeploymentAccessService = mock<MemberDeploymentAccessService>();
    memberDeploymentAccessService.assertMayStillSign.mockResolvedValue(undefined);

    const handler = new ApplyDeploymentUpdateHandler(deploymentWriterService, activityService, authService, memberDeploymentAccessService);

    return { handler, deploymentWriterService, activityService, ability, memberDeploymentAccessService };
  }
});
