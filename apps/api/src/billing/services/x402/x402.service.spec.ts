import type { HTTPRequestContext, PaymentCancellationDispatcher, x402HTTPResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { PostgresError } from "postgres";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { X402TransactionOutput, X402TransactionRepository } from "@src/billing/repositories";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import { X402Service } from "@src/billing/services/x402/x402.service";
import type { X402HttpServerFactoryService } from "@src/billing/services/x402/x402-http-server-factory.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { CreateDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

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
      expect(x402TransactionRepository.markSettledAsSucceeded).toHaveBeenCalledWith(transaction.id);
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
      expect(x402TransactionRepository.markSettledAsSucceeded).toHaveBeenCalledWith(transaction.id);
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

  describe("processDeploy (pay-per-deploy)", () => {
    it("settles, credits the balance and creates a deployment, linking the dseq on the row", async () => {
      const { service, httpServer, x402TransactionRepository, refillService, deploymentWriterService } = setup();
      const transaction = createTransaction({ status: "pending" });
      const deployment = createDeploymentResult();
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
      deploymentWriterService.create.mockResolvedValue(deployment);

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      // Funding flows through the single refill choke point, with no first-purchase/trial bonus.
      expect(refillService.topUpWallet).toHaveBeenCalledWith(transaction.amount, userId, {
        payment: { currency: "usd", paymentMethodType: "x402", transactionId: transaction.id }
      });
      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
      expect(deploymentWriterService.create).toHaveBeenCalledWith({ sdl: createDeployInput().sdl, deposit: amountUsd, userId });
      expect(x402TransactionRepository.linkDeployment).toHaveBeenCalledWith(transaction.id, deployment.dseq);
      expect(x402TransactionRepository.markDeployFailed).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        type: "success",
        headers: { "PAYMENT-RESPONSE": "encoded" },
        data: { transactionId: transaction.id, deploymentDseq: deployment.dseq, settlementTxHash: "0xsettlementhash", manifest: deployment.manifest }
      });
    });

    it("leaves funds credited and flags the row when deployment creation fails after settlement", async () => {
      const { service, httpServer, x402TransactionRepository, refillService, deploymentWriterService } = setup();
      const transaction = createTransaction({ status: "pending" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      httpServer.processSettlement.mockResolvedValue({
        success: true,
        transaction: "0xsettlementhash",
        network: "eip155:8453",
        payer: "0xpayer",
        headers: {},
        requirements: createRequirements()
      });
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(undefined);
      x402TransactionRepository.create.mockResolvedValue(transaction);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue({ ...transaction, status: "settled" });
      deploymentWriterService.create.mockRejectedValue(new Error("broadcast failed"));

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      // The credit happened; the money is safe in the Console balance and never reversed on-chain.
      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
      expect(x402TransactionRepository.markDeployFailed).toHaveBeenCalledWith(transaction.id, "broadcast failed");
      expect(x402TransactionRepository.linkDeployment).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        type: "deploy-failed",
        transactionId: transaction.id,
        amountUsdCents: transaction.amount,
        settlementTxHash: "0xsettlementhash",
        message: "broadcast failed"
      });
    });

    it("rejects with rate-limited and never settles when the per-user request rate limit is exceeded", async () => {
      const { service, httpServer, x402TransactionRepository, refillService, deploymentWriterService } = setup();
      const verified = createVerifiedResult();
      httpServer.processHTTPRequest.mockResolvedValue(verified);
      x402TransactionRepository.countByUserSince.mockResolvedValue(10);

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      expect(result).toMatchObject({ type: "rate-limited", retryAfterSeconds: 3600 });
      expect(verified.cancellationDispatcher.cancel).toHaveBeenCalledWith({ reason: "handler_failed", responseStatus: 429 });
      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(deploymentWriterService.create).not.toHaveBeenCalled();
    });

    it("rejects with cost-ceiling-exceeded and never settles when the per-user spend ceiling is exceeded", async () => {
      const { service, httpServer, x402TransactionRepository, refillService, deploymentWriterService } = setup();
      const verified = createVerifiedResult();
      httpServer.processHTTPRequest.mockResolvedValue(verified);
      // Recent spend already at the $2000 ceiling (in cents); this request would push past it.
      x402TransactionRepository.sumAmountByUserSince.mockResolvedValue(200000);

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      expect(result).toMatchObject({ type: "cost-ceiling-exceeded", ceilingUsdCents: 200000 });
      expect(verified.cancellationDispatcher.cancel).toHaveBeenCalledWith({ reason: "handler_failed", responseStatus: 402 });
      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(deploymentWriterService.create).not.toHaveBeenCalled();
    });

    it("rejects a payment already used for a previous deployment as a duplicate", async () => {
      const { service, httpServer, x402TransactionRepository, refillService, deploymentWriterService } = setup();
      const transaction = createTransaction({ status: "succeeded", deploymentDseq: "999" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(transaction);

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      expect(result).toEqual({ type: "duplicate-payment", transactionId: transaction.id });
      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(deploymentWriterService.create).not.toHaveBeenCalled();
    });

    it("returns payment-required instructions when no payment is attached", async () => {
      const { service, httpServer, deploymentWriterService } = setup();
      httpServer.processHTTPRequest.mockResolvedValue({
        type: "payment-error",
        response: { status: 402, headers: {}, body: { x402Version: 2, accepts: [] } }
      });

      const result = await service.processDeploy(createDeployRequestContext(), userId, createDeployInput());

      expect(result).toMatchObject({ type: "payment-required", response: { status: 402 } });
      expect(deploymentWriterService.create).not.toHaveBeenCalled();
    });
  });

  describe("money-integrity gate", () => {
    it("credits exactly once when the same settled row is driven twice concurrently", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const transaction = createTransaction({ status: "settled", settlementTxHash: "0xsettlementhash" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(transaction);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue(transaction);
      // The conditional UPDATE only affects a row for the first caller; the second sees rowCount 0.
      x402TransactionRepository.markSettledAsSucceeded.mockReset();
      x402TransactionRepository.markSettledAsSucceeded.mockResolvedValueOnce(true).mockResolvedValue(false);

      await Promise.all([service.processTopUp(createRequestContext(), userId, amountUsd), service.processTopUp(createRequestContext(), userId, amountUsd)]);

      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
    });

    it("reconciles a crash-before-credit transaction and credits exactly once", async () => {
      const { service, x402TransactionRepository, refillService } = setup();
      const stranded = createTransaction({ status: "settled", settlementTxHash: "0xsettlementhash" });
      x402TransactionRepository.findStaleSettled.mockResolvedValue([stranded]);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue(stranded);
      // First reconcile pass wins the transition; a second concurrent/duplicate pass gets rowCount 0.
      x402TransactionRepository.markSettledAsSucceeded.mockReset();
      x402TransactionRepository.markSettledAsSucceeded.mockResolvedValueOnce(true).mockResolvedValue(false);

      const first = await service.reconcileStaleSettled();
      const second = await service.reconcileStaleSettled();

      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
      expect(refillService.topUpWallet).toHaveBeenCalledWith(stranded.amount, stranded.userId, {
        payment: { currency: "usd", paymentMethodType: "x402", transactionId: stranded.id }
      });
      expect(first).toEqual({ backlog: 1, credited: 1, failed: 0 });
      expect(second).toEqual({ backlog: 1, credited: 0, failed: 0 });
    });

    it("reports the stale settled backlog it scanned each run", async () => {
      const { service, x402TransactionRepository } = setup();
      x402TransactionRepository.findStaleSettled.mockResolvedValue([]);

      const result = await service.reconcileStaleSettled();

      expect(x402TransactionRepository.findStaleSettled).toHaveBeenCalledWith(expect.any(Date), 100);
      expect(result).toEqual({ backlog: 0, credited: 0, failed: 0 });
    });

    it("counts a failed credit without aborting the rest of the backlog", async () => {
      const { service, x402TransactionRepository, refillService } = setup();
      const failing = createTransaction({ id: "aaaaaaaa-0000-0000-0000-000000000000", status: "settled" });
      const succeeding = createTransaction({ id: "bbbbbbbb-0000-0000-0000-000000000000", status: "settled" });
      x402TransactionRepository.findStaleSettled.mockResolvedValue([failing, succeeding]);
      x402TransactionRepository.findOneByAndLock.mockImplementation(async query => (query?.id === failing.id ? failing : succeeding));
      refillService.topUpWallet.mockRejectedValueOnce(new Error("refill boom"));

      const result = await service.reconcileStaleSettled();

      expect(result).toEqual({ backlog: 2, credited: 1, failed: 1 });
    });
  });

  describe("payment_hash unique violation", () => {
    it("resumes from the winning row instead of throwing when the insert loses the race", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const raced = createTransaction({ status: "settled", settlementTxHash: "0xsettlementhash" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValueOnce(undefined).mockResolvedValue(raced);
      x402TransactionRepository.findOneByAndLock.mockResolvedValue(raced);
      x402TransactionRepository.create.mockRejectedValue(uniqueViolation());

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ type: "success", data: { transactionId: raced.id } });
    });

    it("returns a 409 duplicate when the racing request is still in flight", async () => {
      const { service, httpServer, x402TransactionRepository, refillService } = setup();
      const inFlight = createTransaction({ status: "pending" });
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValueOnce(undefined).mockResolvedValue(inFlight);
      x402TransactionRepository.create.mockRejectedValue(uniqueViolation());

      const result = await service.processTopUp(createRequestContext(), userId, amountUsd);

      expect(result).toEqual({ type: "duplicate-payment", transactionId: inFlight.id });
      expect(httpServer.processSettlement).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("rethrows non-unique-violation insert errors", async () => {
      const { service, httpServer, x402TransactionRepository } = setup();
      httpServer.processHTTPRequest.mockResolvedValue(createVerifiedResult());
      x402TransactionRepository.findByPaymentHash.mockResolvedValue(undefined);
      x402TransactionRepository.create.mockRejectedValue(new Error("connection reset"));

      await expect(service.processTopUp(createRequestContext(), userId, amountUsd)).rejects.toThrow("connection reset");
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
      X402_RECONCILE_THRESHOLD_SECONDS: 300,
      X402_RECONCILE_INTERVAL_SECONDS: 300,
      X402_RECONCILE_BATCH_SIZE: 100,
      X402_MIN_DEPLOY_USD: 1,
      X402_MAX_DEPLOY_USD: 1000,
      X402_ABUSE_WINDOW_SECONDS: 3600,
      X402_ABUSE_MAX_REQUESTS: 10,
      X402_ABUSE_MAX_SPEND_USD: 2000,
      ...configOverrides
    });

    const x402TransactionRepository = mock<X402TransactionRepository>();
    x402TransactionRepository.markSettledAsSucceeded.mockResolvedValue(true);
    x402TransactionRepository.countByUserSince.mockResolvedValue(0);
    x402TransactionRepository.sumAmountByUserSince.mockResolvedValue(0);
    const refillService = mock<RefillService>();
    const httpServer = mock<x402HTTPResourceServer>();
    const httpServerFactory = mock<X402HttpServerFactoryService>();
    httpServerFactory.create.mockReturnValue(httpServer);
    httpServer.initialize.mockResolvedValue();
    const deploymentWriterService = mock<DeploymentWriterService>();

    const service = new X402Service(config, x402TransactionRepository, refillService, httpServerFactory, deploymentWriterService);

    return { service, config, x402TransactionRepository, refillService, httpServer, httpServerFactory, deploymentWriterService };
  }

  function createDeployInput() {
    return { sdl: 'version: "2.0"\nservices:\n  web:\n    image: nginx', deposit: amountUsd };
  }

  function createDeploymentResult(): CreateDeploymentResponse["data"] {
    return {
      dseq: "1234567890",
      manifest: '[{"name":"web"}]',
      signTx: { code: 0, transactionHash: "0xdeploytx", rawLog: "" }
    };
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

  function uniqueViolation(): PostgresError {
    const error = new PostgresError("duplicate key value violates unique constraint");
    (error as PostgresError & { code: string }).code = "23505";
    return error;
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
      deploymentDseq: null,
      deployFailed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  function createDeployRequestContext(): HTTPRequestContext {
    return {
      adapter: {
        getHeader: () => undefined,
        getMethod: () => "POST",
        getPath: () => "/v1/x402/deploy",
        getUrl: () => "https://console-api.akash.network/v1/x402/deploy",
        getAcceptHeader: () => "application/json",
        getUserAgent: () => "test",
        getBody: () => ({ sdl: 'version: "2.0"', deposit: amountUsd })
      },
      path: "/v1/x402/deploy",
      method: "POST",
      paymentHeader: "encoded-payment"
    };
  }
});
