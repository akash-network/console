import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { createdActivityOf, failedCreateActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { CreateDeploymentHandler } from "./create-deployment.handler";

describe(CreateDeploymentHandler.name, () => {
  const ACCEPTED = { userId: "user-1", dseq: "1748400000000", message: "Cg1hY2NlcHRlZA==" };
  const PAYLOAD = { ...ACCEPTED, activityId: "activity-1", version: 1 as const };
  const KEY = { userId: "user-1", dseq: "1748400000000" };
  const FIRST_ATTEMPT = { id: "job-1", retryCount: 0, retryLimit: 6 };
  const RETRY = { id: "job-1", retryCount: 3, retryLimit: 6 };
  const LAST_ATTEMPT = { id: "job-1", retryCount: 6, retryLimit: 6 };

  it("keeps one create per deployment across queued, retrying and running jobs", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("exclusive");
  });

  it("asks only for the right to sign with the wallet of the user who asked for the create", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([{ action: "sign", subject: "UserWallet", conditions: { userId: "user-1" } }]);
  });

  it("creates the accepted deployment on chain and records the create as succeeded", async () => {
    const { handler, deploymentWriterService, activityService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: false });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(KEY));
  });

  it("asks a retry to read the chain first, so it adopts a deployment an earlier attempt created", async () => {
    const { handler, deploymentWriterService, activityService } = setup();

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 1, retryLimit: 6 });

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: true });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(KEY));
  });

  it("treats a run without retry metadata as a single first attempt", async () => {
    const { handler, deploymentWriterService } = setup();

    await handler.handle(PAYLOAD);

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: false });
  });

  it("leaves an activity that is no longer pending alone", async () => {
    const { handler, deploymentWriterService, activityService } = setup({ pending: false });

    await handler.handle(PAYLOAD, RETRY);

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(deploymentWriterService.createOnChain).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records a first attempt the create is refused on as failed with its reason, without waiting for the retries", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const refusal = createError(402, "Not enough balance to cover the deployment deposit.");
    deploymentWriterService.createOnChain.mockRejectedValue(refusal);

    await expect(handler.handle(PAYLOAD, FIRST_ATTEMPT)).rejects.toBe(refusal);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedCreateActivityOf(KEY, refusal));
  });

  it("records an expired create as failed with the reason the create gives", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const expired = createError(409, "This deployment request expired before it reached the chain. Create the deployment again.", {
      errorCode: "deployment_create_expired"
    });
    deploymentWriterService.createOnChain.mockRejectedValue(expired);

    await expect(handler.handle(PAYLOAD, FIRST_ATTEMPT)).rejects.toBe(expired);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_create",
      status: "failed",
      meta: { dseq: KEY.dseq, error: { code: "deployment_create_expired", message: expired.message } }
    });
  });

  it("retries a refusal met on a retry, which a lagging read of a create an earlier attempt landed can cause", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const refusal = createError(402, "Not enough balance to cover the deployment deposit.");
    deploymentWriterService.createOnChain.mockRejectedValue(refusal);

    await expect(handler.handle(PAYLOAD, RETRY)).rejects.toBe(refusal);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "an unexplained failure", error: new Error("signer unreachable") },
    { kind: "an internal error", error: createError(500, "connection to 10.0.0.4 refused") },
    { kind: "a server error exposed to the caller", error: createError(500, "The signer is restarting", { expose: true }) },
    { kind: "a client error not meant for the caller", error: createError(400, "Invalid nonce", { expose: false }) },
    { kind: "a create proven never included", error: new TxNotIncludedError("ABCDEF") },
    { kind: "an undecided outcome", error: new TxOutcomeUnknownError("ABCDEF") }
  ])("leaves $kind on a first attempt with retries to come for the next one to settle", async ({ error }) => {
    const { handler, deploymentWriterService, activityService } = setup();
    deploymentWriterService.createOnChain.mockRejectedValue(error);

    await expect(handler.handle(PAYLOAD, FIRST_ATTEMPT)).rejects.toBe(error);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records the last failed attempt with its reason", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const refusal = createError(402, "Not enough balance to cover the deployment deposit.");
    deploymentWriterService.createOnChain.mockRejectedValue(refusal);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(refusal);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedCreateActivityOf(KEY, refusal));
  });

  it("records an unexplained last failure as failed on our side", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = new Error("signer unreachable");
    deploymentWriterService.createOnChain.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", expect.objectContaining({ status: "failed", meta: expect.objectContaining({ error: expect.objectContaining({ code: "create_failed" }) }) }));
  });

  it("keeps a last attempt with an undecided outcome pending under its hash", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const undecided = new TxOutcomeUnknownError("ABCDEF");
    deploymentWriterService.createOnChain.mockRejectedValue(undecided);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(undecided);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_create",
      status: "pending",
      meta: { dseq: KEY.dseq, txHash: "ABCDEF" }
    });
  });

  it("never records a create that went through as failed when writing its success fails on the last attempt", async () => {
    const { handler, activityService } = setup();
    const writeFailure = new Error("connection terminated");
    activityService.settle.mockRejectedValueOnce(writeFailure);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(writeFailure);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(KEY));
  });

  function setup(input?: { pending?: boolean }) {
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.createOnChain.mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });
    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);

    const handler = new CreateDeploymentHandler(deploymentWriterService, activityService);

    return { handler, deploymentWriterService, activityService };
  }
});
