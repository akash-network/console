import { faker } from "@faker-js/faker";
import { differenceInSeconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BalancesService } from "@src/billing/services/balances/balances.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { type AllowanceCheck, ReconcileDeploymentAllowance } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services";
import { ALLOWANCE_CHECK_DELAY_IN_SECONDS, DeploymentAllowanceService } from "./deployment-allowance.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(DeploymentAllowanceService.name, () => {
  describe("adjust", () => {
    it("grants the limit read at the latest height moved by the delta and watches the grant", async () => {
      const { service, wallet, managedUserWalletService, managedSignerService, jobQueueService } = setup({ limit: 500_000, height: 1234 });

      const result = await service.adjust(wallet, -200_000);

      expect(managedUserWalletService.authorizeDeploymentSpendingOnly).toHaveBeenCalledWith(managedSignerService, {
        address: wallet.address,
        derivationIndex: wallet.id,
        limit: 300_000
      });
      expect(result).toEqual({ previousLimit: 500_000, nextLimit: 300_000, txHash: "GRANT_HASH" });
      expect(scheduledCheck(jobQueueService)).toEqual({
        wallet,
        write: { txHash: "GRANT_HASH", readHeight: 1234, readLimit: 500_000, sentAt: expect.any(String) },
        adjustment: 0,
        round: 0,
        attempt: 0
      });
    });

    it("has a write it should make again if it never lands watched with its delta and round", async () => {
      const { service, wallet, jobQueueService } = setup({ limit: 500_000, height: 1234 });

      await service.adjust(wallet, -200_000, { round: 3, redo: true });

      expect(scheduledCheck(jobQueueService)).toMatchObject({ adjustment: -200_000, round: 3 });
    });

    it("grants no less than nothing when the delta exceeds the limit", async () => {
      const { service, wallet, managedUserWalletService } = setup({ limit: 100_000, height: 1234 });

      const result = await service.adjust(wallet, -200_000);

      expect(managedUserWalletService.authorizeDeploymentSpendingOnly).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 0 }));
      expect(result).toEqual({ previousLimit: 100_000, nextLimit: 0, txHash: "GRANT_HASH" });
    });

    it("watches nothing when no grant had to be broadcast", async () => {
      const { service, wallet, managedUserWalletService, jobQueueService } = setup({ limit: 0, height: 1234 });
      managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue(undefined);

      await service.adjust(wallet, -200_000);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("fails without watching a grant the chain included with an error", async () => {
      const { service, wallet, managedUserWalletService, jobQueueService } = setup({ limit: 500_000, height: 1234 });
      managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue({ code: 13, hash: "FAILED_HASH", rawLog: "out of fees" });

      await expect(service.adjust(wallet, -200_000)).rejects.toMatchObject({
        status: 502,
        txHash: "FAILED_HASH",
        message: "The chain refused the deployment allowance grant"
      });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("watches a grant the signer could not decide by its hash before failing", async () => {
      const { service, wallet, managedUserWalletService, jobQueueService } = setup({ limit: 500_000, height: 1234 });
      const error = new TxOutcomeUnknownError("UNDECIDED_HASH");
      managedUserWalletService.authorizeDeploymentSpendingOnly.mockRejectedValue(error);

      await expect(service.adjust(wallet, -200_000)).rejects.toBe(error);

      expect(scheduledCheck(jobQueueService)).toMatchObject({ write: { txHash: "UNDECIDED_HASH", readHeight: 1234, readLimit: 500_000 } });
    });

    it.each([
      { case: "the signer could not decide the grant nor name its hash", error: new TxOutcomeUnknownError() },
      { case: "the signer refused the grant", error: new Error("insufficient fees") }
    ])("fails without watching anything when $case", async ({ error }) => {
      const { service, wallet, managedUserWalletService, jobQueueService } = setup({ limit: 500_000, height: 1234 });
      managedUserWalletService.authorizeDeploymentSpendingOnly.mockRejectedValue(error);

      await expect(service.adjust(wallet, -200_000)).rejects.toBe(error);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("watch", () => {
    it("checks a grant its caller made, outside the caller's transaction, once the index had time to store it", async () => {
      const { service, wallet, jobQueueService, txService } = setup({ limit: 0, height: 1 });
      const write = { txHash: "GRANT_HASH", readHeight: 1234, readLimit: 500_000, sentAt: new Date().toISOString() };

      await service.watch(wallet, write);

      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      const [job, options] = jobQueueService.enqueue.mock.calls[0];
      expect(job).toBeInstanceOf(ReconcileDeploymentAllowance);
      expect(job.data).toEqual({ wallet, write, adjustment: 0, round: 0, attempt: 0 });
      expect(options?.singletonKey).toBe("ReconcileDeploymentAllowance.GRANT_HASH.0");
      expect(differenceInSeconds(new Date(options!.startAfter as string), new Date())).toBeGreaterThanOrEqual(ALLOWANCE_CHECK_DELAY_IN_SECONDS - 2);
    });

    it("logs rather than fails when the check cannot be scheduled", async () => {
      const { service, wallet, jobQueueService, logger } = setup({ limit: 0, height: 1 });
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      await service.watch(wallet, { txHash: "GRANT_HASH", readHeight: 1234, readLimit: 500_000, sentAt: new Date().toISOString() });

      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_ALLOWANCE_CHECK_SCHEDULE_FAILED", address: wallet.address, txHash: "GRANT_HASH", error });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ limit: 0, height: 1 });

    expect(createLogger).toHaveBeenCalledWith({ context: DeploymentAllowanceService.name });
  });

  function scheduledCheck(jobQueueService: ReturnType<typeof mock<JobQueueService>>): AllowanceCheck {
    return (jobQueueService.enqueue.mock.calls[0][0] as ReconcileDeploymentAllowance).data;
  }

  function setup(input: { limit: number; height: number }) {
    const balancesService = mock<BalancesService>();
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const managedSignerService = mock<ManagedSignerService>();
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const wallet = { id: faker.number.int({ min: 1, max: 100_000 }), address: createAkashAddress() };

    balancesService.retrieveDeploymentLimitAtLatestHeight.mockResolvedValue(input);
    managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue({ code: 0, hash: "GRANT_HASH", rawLog: "" });
    txService.outsideTransaction.mockImplementation(async cb => await cb());

    const service = new DeploymentAllowanceService(balancesService, managedUserWalletService, managedSignerService, jobQueueService, txService, createLogger);

    return { service, wallet, balancesService, managedUserWalletService, managedSignerService, jobQueueService, txService, logger, createLogger };
  }
});
