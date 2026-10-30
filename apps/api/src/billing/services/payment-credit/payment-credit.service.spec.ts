import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import type { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import type { CreateLogger } from "@src/core";
import { PAYMENT_CREDIT_UNDECIDED_ERROR_CODE, PaymentCreditService } from "./payment-credit.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createPaymentCredit } from "@test/seeders/payment-credit.seeder";

describe(PaymentCreditService.name, () => {
  describe("creditOnce", () => {
    it("grants the current deployment limit plus the payment and records the credit as landed", async () => {
      const { service, credit, balancesService, managedUserWalletService, managedSignerService, paymentCreditRepository } = setup();
      balancesService.retrieveDeploymentLimit.mockResolvedValue(500_000);

      await service.creditOnce(credit);

      expect(balancesService.retrieveDeploymentLimit).toHaveBeenCalledWith(credit.wallet);
      expect(paymentCreditRepository.createPending).toHaveBeenCalledWith({
        transactionId: credit.transactionId,
        address: credit.wallet.address,
        amount: credit.amountCents
      });
      expect(managedUserWalletService.authorizeDeploymentSpendingOnly).toHaveBeenCalledWith(managedSignerService, {
        address: credit.wallet.address,
        derivationIndex: credit.wallet.id,
        limit: 500_000 + credit.amountCents * 10000
      });
      expect(paymentCreditRepository.markLanded).toHaveBeenCalledWith(credit.transactionId, "GRANT_HASH");
    });

    it("records the credit as pending before broadcasting its grant", async () => {
      const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();

      await service.creditOnce(credit);

      expect(paymentCreditRepository.createPending.mock.invocationCallOrder[0]).toBeLessThan(
        managedUserWalletService.authorizeDeploymentSpendingOnly.mock.invocationCallOrder[0]
      );
    });

    it("records nothing when the deployment limit cannot be read", async () => {
      const { service, credit, balancesService, paymentCreditRepository, managedUserWalletService } = setup();
      const error = new Error("rest unavailable");
      balancesService.retrieveDeploymentLimit.mockRejectedValue(error);

      await expect(service.creditOnce(credit)).rejects.toBe(error);

      expect(paymentCreditRepository.createPending).not.toHaveBeenCalled();
      expect(managedUserWalletService.authorizeDeploymentSpendingOnly).not.toHaveBeenCalled();
    });

    it("records the credit as landed without a hash when no grant had to be broadcast", async () => {
      const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();
      managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue(undefined);

      await service.creditOnce(credit);

      expect(paymentCreditRepository.markLanded).toHaveBeenCalledWith(credit.transactionId, undefined);
    });

    it("skips the grant of a credit that already landed", async () => {
      const { service, credit, paymentCreditRepository, managedUserWalletService, balancesService, logger } = setup();
      paymentCreditRepository.findByTransactionId.mockResolvedValue(createPaymentCredit({ transactionId: credit.transactionId, status: "landed" }));

      await service.creditOnce(credit);

      expect(paymentCreditRepository.findByTransactionId).toHaveBeenCalledWith(credit.transactionId);
      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
      expect(paymentCreditRepository.createPending).not.toHaveBeenCalled();
      expect(managedUserWalletService.authorizeDeploymentSpendingOnly).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "PAYMENT_CREDIT_ALREADY_LANDED", transactionId: credit.transactionId });
    });

    describe("when an earlier attempt left the credit pending", () => {
      it("marks the credit landed without granting it again when its hash shows the grant on chain", async () => {
        const { service, credit, paymentCreditRepository, txPresenceService, managedUserWalletService } = setup();
        const pending = createPaymentCredit({ transactionId: credit.transactionId });
        paymentCreditRepository.findByTransactionId.mockResolvedValue(pending);
        txPresenceService.findTx.mockResolvedValue({ hash: pending.txHash!, code: 0, height: 100, rawLog: "" });

        await service.creditOnce(credit);

        expect(txPresenceService.findTx).toHaveBeenCalledWith(pending.txHash);
        expect(paymentCreditRepository.markLanded).toHaveBeenCalledWith(credit.transactionId, pending.txHash);
        expect(managedUserWalletService.authorizeDeploymentSpendingOnly).not.toHaveBeenCalled();
      });

      it("grants the credit again when its hash shows the chain refused the grant", async () => {
        const { service, credit, paymentCreditRepository, txPresenceService, managedUserWalletService } = setup();
        const pending = createPaymentCredit({ transactionId: credit.transactionId });
        paymentCreditRepository.findByTransactionId.mockResolvedValue(pending);
        txPresenceService.findTx.mockResolvedValue({ hash: pending.txHash!, code: 5, height: 100, rawLog: "insufficient funds" });

        await service.creditOnce(credit);

        expect(paymentCreditRepository.deletePending).toHaveBeenCalledWith(credit.transactionId);
        expect(paymentCreditRepository.deletePending.mock.invocationCallOrder[0]).toBeLessThan(
          paymentCreditRepository.createPending.mock.invocationCallOrder[0]
        );
        expect(managedUserWalletService.authorizeDeploymentSpendingOnly).toHaveBeenCalledTimes(1);
        expect(paymentCreditRepository.markLanded).toHaveBeenCalledWith(credit.transactionId, "GRANT_HASH");
      });

      it("grants the credit again when its hash is still unseen once the grant could no longer land", async () => {
        const { service, credit, paymentCreditRepository, txPresenceService, managedUserWalletService } = setup({ signerRequestTimeoutMs: 180_000 });
        paymentCreditRepository.findByTransactionId.mockResolvedValue(
          createPaymentCredit({ transactionId: credit.transactionId, createdAt: subMinutes(new Date(), 14) })
        );
        txPresenceService.findTx.mockResolvedValue(null);

        await service.creditOnce(credit);

        expect(paymentCreditRepository.deletePending).toHaveBeenCalledWith(credit.transactionId);
        expect(managedUserWalletService.authorizeDeploymentSpendingOnly).toHaveBeenCalledTimes(1);
      });

      it("refuses to grant the credit while its hash is unseen and the grant could still land", async () => {
        const { service, credit, paymentCreditRepository, txPresenceService, managedUserWalletService, logger } = setup({ signerRequestTimeoutMs: 180_000 });
        const pending = createPaymentCredit({ transactionId: credit.transactionId, createdAt: subMinutes(new Date(), 11) });
        paymentCreditRepository.findByTransactionId.mockResolvedValue(pending);
        txPresenceService.findTx.mockResolvedValue(null);

        await expect(service.creditOnce(credit)).rejects.toMatchObject({ status: 503, errorCode: PAYMENT_CREDIT_UNDECIDED_ERROR_CODE });

        expect(paymentCreditRepository.deletePending).not.toHaveBeenCalled();
        expect(managedUserWalletService.authorizeDeploymentSpendingOnly).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith({
          event: "PAYMENT_CREDIT_UNDECIDED",
          transactionId: credit.transactionId,
          txHash: pending.txHash,
          pendingSince: pending.createdAt
        });
      });

      it("refuses to grant a credit whose attempt left no hash to look up", async () => {
        const { service, credit, paymentCreditRepository, txPresenceService, managedUserWalletService } = setup();
        paymentCreditRepository.findByTransactionId.mockResolvedValue(
          createPaymentCredit({ transactionId: credit.transactionId, txHash: null, createdAt: subMinutes(new Date(), 60) })
        );

        await expect(service.creditOnce(credit)).rejects.toMatchObject({ status: 503, errorCode: PAYMENT_CREDIT_UNDECIDED_ERROR_CODE });

        expect(txPresenceService.findTx).not.toHaveBeenCalled();
        expect(paymentCreditRepository.deletePending).not.toHaveBeenCalled();
        expect(managedUserWalletService.authorizeDeploymentSpendingOnly).not.toHaveBeenCalled();
      });
    });

    describe("when the grant fails", () => {
      it("keeps the credit pending with the signer's hash when the grant's outcome is unknown", async () => {
        const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();
        const error = new TxOutcomeUnknownError("UNDECIDED_HASH");
        managedUserWalletService.authorizeDeploymentSpendingOnly.mockRejectedValue(error);

        await expect(service.creditOnce(credit)).rejects.toBe(error);

        expect(paymentCreditRepository.attachTxHash).toHaveBeenCalledWith(credit.transactionId, "UNDECIDED_HASH");
        expect(paymentCreditRepository.deletePending).not.toHaveBeenCalled();
        expect(paymentCreditRepository.markLanded).not.toHaveBeenCalled();
      });

      it("keeps the credit pending when the signer could not tell the grant's outcome nor its hash", async () => {
        const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();
        const error = new TxOutcomeUnknownError();
        managedUserWalletService.authorizeDeploymentSpendingOnly.mockRejectedValue(error);

        await expect(service.creditOnce(credit)).rejects.toBe(error);

        expect(paymentCreditRepository.attachTxHash).not.toHaveBeenCalled();
        expect(paymentCreditRepository.deletePending).not.toHaveBeenCalled();
      });

      it.each([
        { case: "the signer proved it was not included", error: new TxNotIncludedError("EXPIRED_HASH") },
        { case: "the signer refused it", error: new Error("insufficient fees") }
      ])("releases the credit for another attempt when $case", async ({ error }) => {
        const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();
        managedUserWalletService.authorizeDeploymentSpendingOnly.mockRejectedValue(error);

        await expect(service.creditOnce(credit)).rejects.toBe(error);

        expect(paymentCreditRepository.deletePending).toHaveBeenCalledWith(credit.transactionId);
        expect(paymentCreditRepository.attachTxHash).not.toHaveBeenCalled();
        expect(paymentCreditRepository.markLanded).not.toHaveBeenCalled();
      });

      it("releases the credit and fails when the chain included the grant with an error", async () => {
        const { service, credit, managedUserWalletService, paymentCreditRepository } = setup();
        managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue({ code: 13, hash: "FAILED_HASH", rawLog: "out of fees" });

        await expect(service.creditOnce(credit)).rejects.toMatchObject({ status: 502, txHash: "FAILED_HASH" });

        expect(paymentCreditRepository.deletePending).toHaveBeenCalledWith(credit.transactionId);
        expect(paymentCreditRepository.markLanded).not.toHaveBeenCalled();
      });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: PaymentCreditService.name });
  });

  function setup(input: { signerRequestTimeoutMs?: number } = {}) {
    const paymentCreditRepository = mock<PaymentCreditRepository>();
    const balancesService = mock<BalancesService>();
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const managedSignerService = mock<ManagedSignerService>();
    const txPresenceService = mock<TxPresenceService>();
    const billingConfigService = mockConfigService<BillingConfigService>({ TX_SIGNER_REQUEST_TIMEOUT_MS: input.signerRequestTimeoutMs ?? 180_000 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    paymentCreditRepository.findByTransactionId.mockResolvedValue(undefined);
    balancesService.retrieveDeploymentLimit.mockResolvedValue(0);
    managedUserWalletService.authorizeDeploymentSpendingOnly.mockResolvedValue({ code: 0, hash: "GRANT_HASH", rawLog: "" });

    const credit = {
      transactionId: faker.string.uuid(),
      wallet: { id: faker.number.int({ min: 1, max: 100_000 }), address: createAkashAddress() },
      amountCents: faker.number.int({ min: 100, max: 100_000 })
    };

    const service = new PaymentCreditService(
      paymentCreditRepository,
      balancesService,
      managedUserWalletService,
      managedSignerService,
      txPresenceService,
      billingConfigService,
      createLogger
    );

    return {
      service,
      credit,
      paymentCreditRepository,
      balancesService,
      managedUserWalletService,
      managedSignerService,
      txPresenceService,
      billingConfigService,
      logger,
      createLogger
    };
  }
});
