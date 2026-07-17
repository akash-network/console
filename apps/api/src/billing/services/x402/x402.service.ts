import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { HTTPRequestContext, HTTPResponseInstructions, ProcessSettleSuccessResponse, x402HTTPResourceServer } from "@x402/core/server";
import type { PaymentPayload } from "@x402/core/types";
import { createHash } from "crypto";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { X402TransactionRepository } from "@src/billing/repositories/x402-transaction/x402-transaction.repository";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { X402_ERROR_CODES, type X402ErrorCode } from "@src/billing/services/x402/x402-error-codes";
import { X402HttpServerFactoryService } from "@src/billing/services/x402/x402-http-server-factory.service";
import { WithTransaction } from "@src/core";

export const X402_TOP_UP_ROUTE = "POST /v1/x402/top-up";

export type X402TopUpProcessResult =
  | { type: "payment-required"; code: X402ErrorCode; response: HTTPResponseInstructions }
  | { type: "duplicate-payment"; transactionId: string }
  | {
      type: "success";
      headers: Record<string, string>;
      data: {
        transactionId: string;
        amountUsdCents: number;
        network: string;
        settlementTxHash: string;
        payerAddress?: string;
      };
    };

@singleton()
export class X402Service {
  private readonly logger = createOtelLogger({ context: X402Service.name });

  private httpServer?: x402HTTPResourceServer;

  private initPromise?: Promise<void>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly x402TransactionRepository: X402TransactionRepository,
    private readonly refillService: RefillService,
    private readonly httpServerFactory: X402HttpServerFactoryService
  ) {}

  get isEnabled(): boolean {
    return this.config.X402_ENABLED === "true" && !!this.config.X402_PAY_TO_ADDRESS;
  }

  async processTopUp(context: HTTPRequestContext, userId: string, amountUsd: number): Promise<X402TopUpProcessResult> {
    const httpServer = this.getHttpServer();
    await this.initialize(httpServer);

    const result = await httpServer.processHTTPRequest(context);

    if (result.type === "payment-error") {
      // A verify-stage failure with a payment attached is an invalid payment; without one it is the
      // standard 402 challenge advertising the accepted payment requirements.
      const code = context.paymentHeader ? X402_ERROR_CODES.PAYMENT_INVALID : X402_ERROR_CODES.PAYMENT_REQUIRED;
      return { type: "payment-required", code, response: result.response };
    }

    if (result.type === "no-payment-required") {
      throw new Error("x402 top-up route is misconfigured: payment is always required");
    }

    const { paymentPayload, paymentRequirements, declaredExtensions, cancellationDispatcher } = result;
    const amountUsdCents = Math.round(amountUsd * 100);
    const paymentHash = this.hashPayment(paymentPayload);

    const existing = await this.x402TransactionRepository.findByPaymentHash(paymentHash);

    if (existing?.status === "succeeded") {
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 409 });
      return { type: "duplicate-payment", transactionId: existing.id };
    }

    if (existing?.status === "settled") {
      // Payment already settled on-chain but crediting was interrupted: resume it
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 409 });
      await this.creditSettledTransaction(existing.id);
      return {
        type: "success",
        headers: {},
        data: {
          transactionId: existing.id,
          amountUsdCents: existing.amount,
          network: existing.network,
          settlementTxHash: existing.settlementTxHash ?? "",
          payerAddress: existing.payerAddress ?? undefined
        }
      };
    }

    const transaction =
      existing ??
      (await this.x402TransactionRepository.create({
        userId,
        status: "pending",
        amount: amountUsdCents,
        currency: "usd",
        network: paymentRequirements.network,
        asset: paymentRequirements.asset,
        paymentHash
      }));

    const settleResult = await httpServer.processSettlement(paymentPayload, paymentRequirements, declaredExtensions, { request: context });

    if (!settleResult.success) {
      await this.x402TransactionRepository.updateById(transaction.id, {
        status: "failed",
        errorMessage: settleResult.errorMessage ?? settleResult.errorReason
      });
      this.logger.warn({ event: "X402_SETTLEMENT_FAILED", transactionId: transaction.id, errorReason: settleResult.errorReason });
      return { type: "payment-required", code: X402_ERROR_CODES.PAYMENT_INVALID, response: settleResult.response };
    }

    // Settled on-chain: persist proof first so a crash before crediting is recoverable
    await this.x402TransactionRepository.updateById(transaction.id, {
      status: "settled",
      settlementTxHash: settleResult.transaction,
      payerAddress: settleResult.payer
    });

    await this.creditSettledTransaction(transaction.id);

    this.logger.info({
      event: "X402_TOP_UP_SUCCEEDED",
      transactionId: transaction.id,
      userId,
      amountUsdCents,
      network: paymentRequirements.network,
      settlementTxHash: settleResult.transaction
    });

    return {
      type: "success",
      headers: this.pickPaymentResponseHeaders(settleResult),
      data: {
        transactionId: transaction.id,
        amountUsdCents,
        network: paymentRequirements.network,
        settlementTxHash: settleResult.transaction,
        payerAddress: settleResult.payer
      }
    };
  }

  @WithTransaction()
  private async creditSettledTransaction(transactionId: string): Promise<void> {
    const transaction = await this.x402TransactionRepository.findOneByAndLock({ id: transactionId });

    if (!transaction || transaction.status !== "settled") {
      return;
    }

    await this.x402TransactionRepository.updateById(transaction.id, { status: "succeeded" });
    await this.refillService.topUpWallet(transaction.amount, transaction.userId, {
      payment: {
        currency: transaction.currency,
        paymentMethodType: "x402",
        transactionId: transaction.id
      }
    });
  }

  private getHttpServer(): x402HTTPResourceServer {
    this.httpServer ??= this.httpServerFactory.create({
      facilitatorUrl: this.config.X402_FACILITATOR_URL,
      network: this.config.X402_NETWORK,
      routes: {
        [X402_TOP_UP_ROUTE]: {
          description: "Top up Akash Console credits with a USDC payment",
          mimeType: "application/json",
          accepts: {
            scheme: "exact",
            network: this.config.X402_NETWORK,
            payTo: this.config.X402_PAY_TO_ADDRESS!,
            price: context => `$${this.parseAmount(context)}`,
            maxTimeoutSeconds: 300
          }
        }
      }
    });

    return this.httpServer;
  }

  private async initialize(httpServer: x402HTTPResourceServer): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = httpServer.initialize().catch(error => {
        this.initPromise = undefined;
        throw error;
      });
    }

    await this.initPromise;
  }

  private parseAmount(context: HTTPRequestContext): number {
    const raw = context.adapter.getQueryParam?.("amount");
    const amount = Number(Array.isArray(raw) ? raw[0] : raw);

    if (!Number.isFinite(amount) || amount < this.config.X402_MIN_TOP_UP_USD || amount > this.config.X402_MAX_TOP_UP_USD) {
      throw new Error(`x402 top-up amount must be between ${this.config.X402_MIN_TOP_UP_USD} and ${this.config.X402_MAX_TOP_UP_USD} USD`);
    }

    return amount;
  }

  private hashPayment(paymentPayload: PaymentPayload): string {
    return createHash("sha256").update(JSON.stringify(paymentPayload.payload)).digest("hex");
  }

  private pickPaymentResponseHeaders(settleResult: ProcessSettleSuccessResponse): Record<string, string> {
    return settleResult.headers ?? {};
  }
}
