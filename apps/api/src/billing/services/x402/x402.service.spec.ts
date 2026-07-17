import type { HTTPRequestContext, PaymentCancellationDispatcher, x402HTTPResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { X402TransactionOutput, X402TransactionRepository } from "@src/billing/repositories";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import { X402Service } from "@src/billing/services/x402/x402.service";
import type { X402HttpServerFactoryService } from "@src/billing/services/x402/x402-http-server-factory.service";
import { TxService } from "@src/core/services/tx/tx.service";

describe(X402Service.name, () => {
  const userId = "test-user-id";
  const amountUsd = 25;

  beforeEach(() => {
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    container.registerInstance(TxService, txService);
  });

  describe("processTopUp", () => {
    it("returns payment instructions when no payment is attached", async () => {
      const { service, httpServer } = setup();
      httpServer.processHTTPRequest.mockResolvedValue({
        type: "payment-error",
        response: { status: 402, headers: {}, body: { x402Version: 2, accepts: [] } }
      });

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(result).toMatchObject({ type: "payment-required", response: { status: 402 } });
    });

    it("settles the payment, records the transaction and credits the wallet", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "pending" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      httpServer.processSettlement.mockResolvedValue({
        success: true,
        transaction: "0xsettlementhash",
        network: "eip155:8453",
        payer: "0xpayer",
        headers: { "PAYMENT-RESPONSE": "encoded" },
        requirements: createRequirements()
      });
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(undefined);
      x402TransactionRepository.create.mockResolvedValue(transaction);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue({ ...transaction, status: "settled" });

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(x402TransactionRepository.create).toHaveBeenCalledWith({
        userId,
        status: "pending",
        amount: 2500,
        currency: "usd",
        network: "eip155:8453",
        asset: "0xusdc",
        paymentHash: expect.any(String)
      });
      expect(httpServer.processSettlement).toHaveBeenCalled();
      expect(x402TransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, {
        status: "settled",
        settlementTxHash: "0xsettlementhash",
        payerAddress: "0xpayer"
      });
      expect(x402TransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, { status: "succeeded" });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(transaction.amount, userId, {
        payment: {
          currency: "usd",
          paymentMethodType: "x402",
          transactionId: transaction.id
        }
      });
      expect(result).toMatchObject({
        type: "success",
        headers: { "PAYMENT-RESPONSE": "encoded" },
        data: { transactionId: transaction.id, amountUsdCents: 2500, settlementTxHash: "0xsettlementhash" }
      });
    });

    it("marks the transaction failed and returns 402 instructions when settlement fails", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "pending" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      httpServer.processSettlement.mockResolvedValue({
        success: false,
        transaction: "",
        network: "eip155:8453",
        errorReason: "insufficient_funds",
        errorMessage: "not enough USDC",
        headers: {},
        response: { status: 402, headers: {}, body: {} }
      });
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(undefined);
      x402TransactionRepository.create.mockResolvedValue(transaction);

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(x402TransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, {
        status: "failed",
        errorMessage: "not enough USDC"
      });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(result).toMatchObject({ type: "payment-required", response: { status: 402 } });
    });

    it("rejects a payment that was already used for a successful top-up", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "succeeded" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(transaction);

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(result).toEqual({ type: "duplicate-payment", transactionId: transaction.id });
      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("resumes crediting for a payment that settled but was not credited", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "settled", settlementTxHash: "0xsettlementhash" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(transaction);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue(transaction);

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(x402TransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, { status: "succeeded" });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(transaction.amount, transaction.userId, expect.anything());
      expect(result).toMatchObject({ type: "success", data: { transactionId: transaction.id, settlementTxHash: "0xsettlementhash" } });
    });

    it("does not double credit when the transaction is already succeeded at credit time", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "pending" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      httpServer.processSettlement.mockResolvedValue({
        success: true,
        transaction: "0xsettlementhash",
        network: "eip155:8453",
        headers: {},
        requirements: createRequirements()
      });
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(undefined);
      x402TransactionRepository.create.mockResolvedValue(transaction);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue({ ...transaction, status: "succeeded" });

      await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });
  });

  describe("isEnabled", () => {
    it("is disabled unless both the flag and the payTo address are configured", () => {
      expect(setup({ X402_ENABLED: "false" }).service.isEnabled).toBe(false);
      expect(setup({ X402_PAY_TO_ADDRESS: undefined }).service.isEnabled).toBe(false);
      expect(setup().service.isEnabled).toBe(true);
    });
  });

  function setup(configOverrides: Partial<BillingConfig> = {}) {
    const config = mock<BillingConfig>();
    Object.assign(config, {
      X402_ENABLED: "true",
      X402_PAY_TO_ADDRESS: "0x1111111111111111111111111111111111111111",
      X402_NETWORK: "eip155:8453",
      X402_FACILITATOR_URL: "https://x402.org/facilitator",
      X402_MIN_TOP_UP_USD: 1,
      X402_MAX_TOP_UP_USD: 1000,
      ...configOverrides
    });

    const x402TransactionRepository = mock<X402TransactionRepository>();
    const refillService = mock<RefillService>();
    const httpServer = mock<x402HTTPResourceServer>();
    const httpServerFactory = mock<X402HttpServerFactoryService>();
    httpServerFactory.create.mockReturnValue(httpServer);
    httpServer.initialize.mockResolvedValue();

    const service = new X402Service(config, x402TransactionRepository, refillService, httpServerFactory);

    return { service, config, x402TransactionRepository, refillService, httpServer, httpServerFactory };
  }

  function createRequestContext(): HTTPRequestContext {
    return {
      adapter: {
        getHeader: () => undefined,
        getMethod: () => "POST",
        getPath: () => "/v1/x402/top-up",
        getUrl: () => `https://console-api.akash.network/v1/x402/top-up?amount=${amountUsd}`,
        getAcceptHeader: () => "application/json",
        getUserAgent: () => "test",
        getQueryParam: () => String(amountUsd)
      },
      path: "/v1/x402/top-up",
      method: "POST",
      paymentHeader: "encoded-payment"
    };
  }

  function createVerifiedResult() {
    return {
      type: "payment-verified" as const,
      cancellationDispatcher: mock<PaymentCancellationDispatcher>(),
      paymentPayload: createPaymentPayload(),
      paymentRequirements: createRequirements()
    };
  }

  function createPaymentPayload(): PaymentPayload {
    return {
      x402Version: 2,
      accepted: createRequirements(),
      payload: { signature: "0xsig", authorization: { nonce: "0xnonce" } }
    };
  }

  function createRequirements(): PaymentRequirements {
    return {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xusdc",
      amount: "25000000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {}
    };
  }

  function createTransaction(overrides: Partial<X402TransactionOutput> = {}): X402TransactionOutput {
    return {
      id: "11111111-2222-3333-4444-555555555555",
      userId,
      status: "pending",
      amount: 2500,
      currency: "usd",
      network: "eip155:8453",
      asset: "0xusdc",
      paymentHash: "hash",
      payerAddress: null,
      settlementTxHash: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }
});
