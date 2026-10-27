import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { CreateLogger, TxService } from "@src/core";
import type { AutoLeaseService } from "@src/deployment/services/auto-lease/auto-lease.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import type { UserGpuBidCheckService } from "@src/deployment/services/user-gpu-bid-check/user-gpu-bid-check.service";
import { createdActivityOf, failedCreateActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { CreateDeploymentHandler } from "./create-deployment.handler";

describe(CreateDeploymentHandler.name, () => {
  const ACCEPTED = { userId: "user-1", walletId: 7, dseq: "1748400000000", message: "Cg1hY2NlcHRlZA==" };
  const PAYLOAD = { ...ACCEPTED, activityId: "activity-1", version: 1 as const };
  const KEY = { userId: "user-1", dseq: "1748400000000" };
  const FIRST_ATTEMPT = { id: "job-1", retryCount: 0, retryLimit: 6 };
  const RETRY = { id: "job-1", retryCount: 3, retryLimit: 6 };
  const LAST_ATTEMPT = { id: "job-1", retryCount: 6, retryLimit: 6 };

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: CreateDeploymentHandler.name });
  });

  it("keeps one create per deployment across queued, retrying and running jobs", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("exclusive");
  });

  it("asks only for the right to sign with the wallet the request resolved", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([{ action: "sign", subject: "UserWallet", conditions: { id: 7 } }]);
  });

  it("creates the accepted deployment on chain and records the create as succeeded", async () => {
    const { handler, deploymentWriterService, activityService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: false, assertMayStillSign: expect.any(Function) });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(KEY));
  });

  it("schedules the gpu bid checks of a configure page create once the deployment is on chain", async () => {
    const { handler, deploymentWriterService, userGpuBidCheckService } = setup();

    await handler.handle({ ...PAYLOAD, recordGpuBids: true }, FIRST_ATTEMPT);

    expect(userGpuBidCheckService.scheduleFor).toHaveBeenCalledWith(ACCEPTED);
    expect(userGpuBidCheckService.scheduleFor.mock.invocationCallOrder[0]).toBeGreaterThan(deploymentWriterService.createOnChain.mock.invocationCallOrder[0]);
  });

  it("starts matching a one-click deploy's provider in the transaction that records the create as succeeded", async () => {
    const { handler, activityService, autoLeaseService, txService } = setup();
    let isInTransaction = false;
    txService.transaction.mockImplementation(async cb => {
      isInTransaction = true;
      const result = await cb();
      isInTransaction = false;
      return result;
    });
    autoLeaseService.start.mockImplementation(async () => {
      expect(isInTransaction).toBe(true);
    });

    await handler.handle({ ...PAYLOAD, autoLease: true }, FIRST_ATTEMPT);

    expect(autoLeaseService.start).toHaveBeenCalledWith(ACCEPTED);
    expect(autoLeaseService.start.mock.invocationCallOrder[0]).toBeGreaterThan(activityService.settle.mock.invocationCallOrder[0]);
    expect(txService.transaction).toHaveBeenCalledTimes(1);
  });

  it("starts no match for a create that is not a one-click deploy", async () => {
    const { handler, autoLeaseService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(autoLeaseService.start).not.toHaveBeenCalled();
  });

  it("starts no match for a create that did not land", async () => {
    const { handler, deploymentWriterService, autoLeaseService } = setup();
    deploymentWriterService.createOnChain.mockRejectedValue(new Error("tx-signer unavailable"));

    await expect(handler.handle({ ...PAYLOAD, autoLease: true }, RETRY)).rejects.toThrow("tx-signer unavailable");

    expect(autoLeaseService.start).not.toHaveBeenCalled();
  });

  it("schedules no gpu bid check for a create made elsewhere than the configure page", async () => {
    const { handler, userGpuBidCheckService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(userGpuBidCheckService.scheduleFor).not.toHaveBeenCalled();
  });

  it("schedules no gpu bid check for a create that did not land", async () => {
    const { handler, deploymentWriterService, userGpuBidCheckService } = setup();
    deploymentWriterService.createOnChain.mockRejectedValue(new Error("tx-signer unavailable"));

    await expect(handler.handle({ ...PAYLOAD, recordGpuBids: true }, RETRY)).rejects.toThrow("tx-signer unavailable");

    expect(userGpuBidCheckService.scheduleFor).not.toHaveBeenCalled();
  });

  it("has the writer check, right before it signs, that the member who asked may still sign with the wallet for this deployment", async () => {
    const { handler, deploymentWriterService, memberDeploymentAccessService } = setup();

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);
    const [, options] = deploymentWriterService.createOnChain.mock.calls[0];

    expect(memberDeploymentAccessService.assertMayStillSign).not.toHaveBeenCalled();
    await options?.assertMayStillSign?.();
    expect(memberDeploymentAccessService.assertMayStillSign).toHaveBeenCalledWith({ userId: "user-1", walletId: 7, dseq: KEY.dseq });
  });

  it("asks a retry to read the chain first, so it adopts a deployment an earlier attempt created", async () => {
    const { handler, deploymentWriterService, activityService } = setup();

    await handler.handle(PAYLOAD, { id: "job-1", retryCount: 1, retryLimit: 6 });

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: true, assertMayStillSign: expect.any(Function) });
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(KEY));
  });

  it("treats a run without retry metadata as a single first attempt", async () => {
    const { handler, deploymentWriterService } = setup();

    await handler.handle(PAYLOAD);

    expect(deploymentWriterService.createOnChain).toHaveBeenCalledWith(ACCEPTED, { retry: false, assertMayStillSign: expect.any(Function) });
  });

  it("leaves an activity that is no longer pending alone", async () => {
    const { handler, deploymentWriterService, activityService } = setup({ pending: false });

    await handler.handle(PAYLOAD, RETRY);

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(deploymentWriterService.createOnChain).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records a first attempt the create is refused on as failed with its reason and ends the job without a retry", async () => {
    const { handler, deploymentWriterService, activityService, logger } = setup();
    const refusal = createError(402, "Not enough balance to cover the deployment deposit.", { errorCode: "insufficient_balance" });
    deploymentWriterService.createOnChain.mockRejectedValue(refusal);

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", failedCreateActivityOf(KEY, refusal));
    expect(logger.info).toHaveBeenCalledWith({
      event: "BACKGROUND_DEPLOYMENT_CREATE_REFUSED",
      activityId: "activity-1",
      walletId: 7,
      dseq: KEY.dseq,
      status: 402,
      errorCode: "insufficient_balance"
    });
  });

  it.each([
    { attempt: "a first attempt", job: FIRST_ATTEMPT },
    { attempt: "a retry", job: RETRY },
    { attempt: "the last attempt", job: LAST_ATTEMPT }
  ])("records access the member lost before $attempt signed as failed and ends the job", async ({ job }) => {
    const { handler, deploymentWriterService, activityService } = setup();
    const revoked = createError(403, "You no longer have access to this deployment.", { errorCode: "access_revoked" });
    deploymentWriterService.createOnChain.mockRejectedValue(revoked);

    await handler.handle(PAYLOAD, job);

    expect(activityService.settle).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_create",
      status: "failed",
      initiator: "user",
      meta: { dseq: KEY.dseq, error: { code: "access_revoked", message: "You no longer have access to this deployment." } },
      dedupeKey: null
    });
  });

  it("retries any other 403 met on a retry, like any other refusal there", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const forbidden = createError(403, "The organization was deleted", { errorCode: "organization_forbidden" });
    deploymentWriterService.createOnChain.mockRejectedValue(forbidden);

    await expect(handler.handle(PAYLOAD, RETRY)).rejects.toBe(forbidden);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("records an expired create as failed with the reason the create gives", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const expired = createError(409, "This deployment request expired before it reached the chain. Create the deployment again.", {
      errorCode: "deployment_create_expired"
    });
    deploymentWriterService.createOnChain.mockRejectedValue(expired);

    await handler.handle(PAYLOAD, FIRST_ATTEMPT);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_create",
      status: "failed",
      initiator: "user",
      meta: { dseq: KEY.dseq, error: { code: "deployment_create_expired", message: expired.message } },
      dedupeKey: null
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

  it("leaves an unexplained last failure pending for the check to settle from the chain, since the create may have landed", async () => {
    const { handler, deploymentWriterService, activityService } = setup();
    const failure = new Error("signer unreachable");
    deploymentWriterService.createOnChain.mockRejectedValue(failure);

    await expect(handler.handle(PAYLOAD, LAST_ATTEMPT)).rejects.toBe(failure);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", {
      userId: "user-1",
      type: "deployment_create",
      status: "pending",
      initiator: "user",
      meta: { dseq: KEY.dseq },
      dedupeKey: null
    });
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
      initiator: "user",
      meta: { dseq: KEY.dseq, txHash: "ABCDEF" },
      dedupeKey: null
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

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const memberDeploymentAccessService = mock<MemberDeploymentAccessService>();
    const userGpuBidCheckService = mock<UserGpuBidCheckService>();

    const autoLeaseService = mock<AutoLeaseService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const handler = new CreateDeploymentHandler(
      deploymentWriterService,
      activityService,
      memberDeploymentAccessService,
      userGpuBidCheckService,
      autoLeaseService,
      txService,
      createLogger
    );

    return {
      handler,
      deploymentWriterService,
      activityService,
      memberDeploymentAccessService,
      userGpuBidCheckService,
      autoLeaseService,
      txService,
      logger,
      createLogger
    };
  }
});
