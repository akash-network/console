import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RefundDebitRepository } from "@src/billing/repositories/refund-debit/refund-debit.repository";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import type { CreateLogger } from "@src/core";
import { REFUND_DEBIT_UNDECIDED_ERROR_CODE, RefundDebitService } from "./refund-debit.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createRefundDebit } from "@test/seeders/refund-debit.seeder";

describe(RefundDebitService.name, () => {
  describe("debitOnce", () => {
    it("debits the refund from the deployment allowance, records the debit as landed and returns the adjustment", async () => {
      const { service, debit, refundDebitRepository, deploymentAllowanceService } = setup();
      deploymentAllowanceService.adjust.mockResolvedValue({ previousLimit: 900_000_000, nextLimit: 400_000_000, txHash: "DEBIT_HASH" });

      const result = await service.debitOnce(debit);

      expect(refundDebitRepository.findRefundedBeyond).toHaveBeenCalledWith(debit.transactionId, debit.refundedBefore);
      expect(refundDebitRepository.createPending).toHaveBeenCalledWith({
        transactionId: debit.transactionId,
        amountRefunded: debit.refundedAfter,
        address: debit.wallet.address,
        amount: debit.amountCents
      });
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(debit.wallet, -debit.amountCents * 10000);
      expect(refundDebitRepository.markLanded).toHaveBeenCalledWith({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter }, "DEBIT_HASH");
      expect(result).toEqual({ previousLimit: 900_000_000, nextLimit: 400_000_000, txHash: "DEBIT_HASH" });
    });

    it("records the debit as pending before granting it", async () => {
      const { service, debit, refundDebitRepository, deploymentAllowanceService } = setup();

      await service.debitOnce(debit);

      expect(refundDebitRepository.createPending.mock.invocationCallOrder[0]).toBeLessThan(deploymentAllowanceService.adjust.mock.invocationCallOrder[0]);
    });

    it("records the debit as landed without a hash when no grant had to be broadcast", async () => {
      const { service, debit, refundDebitRepository, deploymentAllowanceService } = setup();
      deploymentAllowanceService.adjust.mockResolvedValue({ previousLimit: 0, nextLimit: 0 });

      await service.debitOnce(debit);

      expect(refundDebitRepository.markLanded).toHaveBeenCalledWith(expect.objectContaining({ amountRefunded: debit.refundedAfter }), undefined);
    });

    it.each([
      { case: "an earlier delivery of the same refund landed", landedThrough: 50_00 },
      { case: "a later refund of the payment landed past it", landedThrough: 80_00 }
    ])("skips the debit when $case", async ({ landedThrough }) => {
      const { service, refundDebitRepository, deploymentAllowanceService, logger } = setup();
      const debit = createDebit({ refundedBefore: 0, refundedAfter: 50_00, amountCents: 50_00 });
      refundDebitRepository.findRefundedBeyond.mockResolvedValue([
        createRefundDebit({ transactionId: debit.transactionId, amountRefunded: landedThrough, status: "landed" })
      ]);

      const result = await service.debitOnce(debit);

      expect(result).toBeUndefined();
      expect(refundDebitRepository.createPending).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "REFUND_DEBIT_ALREADY_LANDED",
        transactionId: debit.transactionId,
        amountRefunded: 50_00,
        debitedThrough: landedThrough
      });
    });

    it("debits only the part of the refund that earlier deliveries left undebited", async () => {
      const { service, refundDebitRepository, deploymentAllowanceService } = setup();
      const debit = createDebit({ refundedBefore: 10_00, refundedAfter: 50_00, amountCents: 40_00 });
      refundDebitRepository.findRefundedBeyond.mockResolvedValue([
        createRefundDebit({ transactionId: debit.transactionId, amountRefunded: 30_00, status: "landed" }),
        createRefundDebit({ transactionId: debit.transactionId, amountRefunded: 20_00, status: "landed" })
      ]);

      await service.debitOnce(debit);

      expect(refundDebitRepository.createPending).toHaveBeenCalledWith(expect.objectContaining({ amountRefunded: 50_00, amount: 20_00 }));
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(debit.wallet, -20_00 * 10000);
    });

    describe("when an earlier delivery left a debit pending", () => {
      it("counts the debit without granting it again when its hash shows it on chain", async () => {
        const { service, debit, refundDebitRepository, txPresenceService, deploymentAllowanceService } = setup();
        const pending = createRefundDebit({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter });
        refundDebitRepository.findRefundedBeyond.mockResolvedValue([pending]);
        txPresenceService.findTx.mockResolvedValue({ hash: pending.txHash!, code: 0, height: 100, rawLog: "" });

        const result = await service.debitOnce(debit);

        expect(result).toBeUndefined();
        expect(txPresenceService.findTx).toHaveBeenCalledWith(pending.txHash);
        expect(refundDebitRepository.markLanded).toHaveBeenCalledWith(pending, pending.txHash);
        expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      });

      it("debits the refund again when its hash shows the chain refused the debit", async () => {
        const { service, debit, refundDebitRepository, txPresenceService, deploymentAllowanceService } = setup();
        const pending = createRefundDebit({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter });
        refundDebitRepository.findRefundedBeyond.mockResolvedValue([pending]);
        txPresenceService.findTx.mockResolvedValue({ hash: pending.txHash!, code: 5, height: 100, rawLog: "insufficient funds" });

        await service.debitOnce(debit);

        expect(refundDebitRepository.deletePending).toHaveBeenCalledWith(pending);
        expect(refundDebitRepository.deletePending.mock.invocationCallOrder[0]).toBeLessThan(refundDebitRepository.createPending.mock.invocationCallOrder[0]);
        expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(debit.wallet, -debit.amountCents * 10000);
      });

      it("debits the refund again when its hash is still unseen once the debit could no longer land", async () => {
        const { service, debit, refundDebitRepository, txPresenceService, deploymentAllowanceService } = setup({ signerRequestTimeoutMs: 180_000 });
        const pending = createRefundDebit({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter, createdAt: subMinutes(new Date(), 14) });
        refundDebitRepository.findRefundedBeyond.mockResolvedValue([pending]);
        txPresenceService.findTx.mockResolvedValue(null);

        await service.debitOnce(debit);

        expect(refundDebitRepository.deletePending).toHaveBeenCalledWith(pending);
        expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(1);
      });

      it("refuses to debit the refund while its hash is unseen and the debit could still land", async () => {
        const { service, debit, refundDebitRepository, txPresenceService, deploymentAllowanceService, logger } = setup({ signerRequestTimeoutMs: 180_000 });
        const pending = createRefundDebit({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter, createdAt: subMinutes(new Date(), 11) });
        refundDebitRepository.findRefundedBeyond.mockResolvedValue([pending]);
        txPresenceService.findTx.mockResolvedValue(null);

        await expect(service.debitOnce(debit)).rejects.toMatchObject({
          status: 503,
          errorCode: REFUND_DEBIT_UNDECIDED_ERROR_CODE,
          message: "The refund's debit may still be landing, so it is not debited again until its outcome is known"
        });

        expect(refundDebitRepository.deletePending).not.toHaveBeenCalled();
        expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith({
          event: "REFUND_DEBIT_UNDECIDED",
          transactionId: pending.transactionId,
          amountRefunded: pending.amountRefunded,
          address: pending.address,
          txHash: pending.txHash,
          pendingSince: pending.createdAt
        });
      });

      it("refuses to debit the refund when the earlier attempt left no hash to look up", async () => {
        const { service, debit, refundDebitRepository, txPresenceService, deploymentAllowanceService } = setup();
        refundDebitRepository.findRefundedBeyond.mockResolvedValue([
          createRefundDebit({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter, txHash: null, createdAt: subMinutes(new Date(), 60) })
        ]);

        await expect(service.debitOnce(debit)).rejects.toMatchObject({ status: 503, errorCode: REFUND_DEBIT_UNDECIDED_ERROR_CODE });

        expect(txPresenceService.findTx).not.toHaveBeenCalled();
        expect(refundDebitRepository.deletePending).not.toHaveBeenCalled();
        expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      });
    });

    describe("when the debit fails", () => {
      it("keeps the debit pending with the signer's hash when the grant's outcome is unknown", async () => {
        const { service, debit, deploymentAllowanceService, refundDebitRepository } = setup();
        const error = new TxOutcomeUnknownError("UNDECIDED_HASH");
        deploymentAllowanceService.adjust.mockRejectedValue(error);

        await expect(service.debitOnce(debit)).rejects.toBe(error);

        expect(refundDebitRepository.attachTxHash).toHaveBeenCalledWith(
          { transactionId: debit.transactionId, amountRefunded: debit.refundedAfter },
          "UNDECIDED_HASH"
        );
        expect(refundDebitRepository.deletePending).not.toHaveBeenCalled();
        expect(refundDebitRepository.markLanded).not.toHaveBeenCalled();
      });

      it("keeps the debit pending when the signer could tell neither the grant's outcome nor its hash", async () => {
        const { service, debit, deploymentAllowanceService, refundDebitRepository } = setup();
        const error = new TxOutcomeUnknownError();
        deploymentAllowanceService.adjust.mockRejectedValue(error);

        await expect(service.debitOnce(debit)).rejects.toBe(error);

        expect(refundDebitRepository.attachTxHash).not.toHaveBeenCalled();
        expect(refundDebitRepository.deletePending).not.toHaveBeenCalled();
      });

      it.each([
        { case: "the signer proved it was not included", error: new TxNotIncludedError("EXPIRED_HASH") },
        { case: "the deployment allowance could not be read or granted", error: new Error("rest unavailable") }
      ])("releases the debit for another delivery when $case", async ({ error }) => {
        const { service, debit, deploymentAllowanceService, refundDebitRepository } = setup();
        deploymentAllowanceService.adjust.mockRejectedValue(error);

        await expect(service.debitOnce(debit)).rejects.toBe(error);

        expect(refundDebitRepository.deletePending).toHaveBeenCalledWith({ transactionId: debit.transactionId, amountRefunded: debit.refundedAfter });
        expect(refundDebitRepository.attachTxHash).not.toHaveBeenCalled();
        expect(refundDebitRepository.markLanded).not.toHaveBeenCalled();
      });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: RefundDebitService.name });
  });

  function createDebit(overrides: { refundedBefore: number; refundedAfter: number; amountCents: number }) {
    return {
      transactionId: faker.string.uuid(),
      wallet: { id: faker.number.int({ min: 1, max: 100_000 }), address: createAkashAddress() },
      ...overrides
    };
  }

  function setup(input: { signerRequestTimeoutMs?: number } = {}) {
    const refundDebitRepository = mock<RefundDebitRepository>();
    const deploymentAllowanceService = mock<DeploymentAllowanceService>();
    const txPresenceService = mock<TxPresenceService>();
    const billingConfigService = mockConfigService<BillingConfigService>({ TX_SIGNER_REQUEST_TIMEOUT_MS: input.signerRequestTimeoutMs ?? 180_000 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    refundDebitRepository.findRefundedBeyond.mockResolvedValue([]);
    deploymentAllowanceService.adjust.mockResolvedValue({ previousLimit: 0, nextLimit: 0, txHash: "DEBIT_HASH" });

    const refundedBefore = faker.number.int({ min: 0, max: 1_000 });
    const amountCents = faker.number.int({ min: 100, max: 100_000 });
    const debit = createDebit({ refundedBefore, refundedAfter: refundedBefore + amountCents, amountCents });

    const service = new RefundDebitService(refundDebitRepository, deploymentAllowanceService, txPresenceService, billingConfigService, createLogger);

    return { service, debit, refundDebitRepository, deploymentAllowanceService, txPresenceService, billingConfigService, logger, createLogger };
  }
});
