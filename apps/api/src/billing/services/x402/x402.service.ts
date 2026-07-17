import { createOtelLogger } from "@akashnetwork/logging/otel";
import type {
  HTTPRequestContext,
  HTTPResponseInstructions,
  ProcessSettleSuccessResponse,
  RouteConfig,
  RoutesConfig,
  x402HTTPResourceServer
} from "@x402/core/server";
import type { Network, PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { createHash } from "crypto";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { X402TransactionRepository } from "@src/billing/repositories/x402-transaction/x402-transaction.repository";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { X402HttpServerFactoryService } from "@src/billing/services/x402/x402-http-server-factory.service";
import { WithTransaction } from "@src/core";

export const X402_TOP_UP_ROUTE = "POST /v1/x402/top-up";

/** Explicit reasons a verified payment can be rejected before settlement. */
export type X402ValidationCode = "WRONG_NETWORK" | "WRONG_ASSET" | "AMOUNT_MISMATCH";

/**
 * Canonical, statically-known description of one x402-protected route's accepted payment.
 * This is the single source both the 402 flow (via {@link X402Service.buildRoutesConfig})
 * and the public discovery endpoint (via {@link X402Service.getDiscovery}) derive from.
 */
export interface X402RouteAccepts {
  scheme: "exact";
  network: Network;
  payTo: string;
  maxTimeoutSeconds: number;
  currency: "USD";
  minAmountUsd: number;
  maxAmountUsd: number;
}

export interface X402CanonicalRoute {
  route: string;
  description: string;
  mimeType: string;
  accepts: X402RouteAccepts;
}

export interface X402DiscoveryAccepts {
  scheme: string;
  network: string;
  payTo: string;
  currency: string;
  minAmountUsd: number;
  maxAmountUsd: number;
  maxTimeoutSeconds: number;
}

export interface X402DiscoveryResource {
  resource: string;
  description: string;
  mimeType: string;
  accepts: X402DiscoveryAccepts[];
}

export interface X402DiscoveryResult {
  x402Version: number;
  resources: X402DiscoveryResource[];
}

export type X402TopUpProcessResult =
  | { type: "payment-required"; response: HTTPResponseInstructions }
  | { type: "payment-rejected"; code: X402ValidationCode; response: HTTPResponseInstructions }
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
      return { type: "payment-required", response: result.response };
    }

    if (result.type === "no-payment-required") {
      throw new Error("x402 top-up route is misconfigured: payment is always required");
    }

    const { paymentPayload, paymentRequirements, declaredExtensions, cancellationDispatcher } = result;

    const validationCode = this.validatePreSettle(paymentPayload, paymentRequirements);

    if (validationCode) {
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 402 });
      this.logger.warn({
        event: "X402_PRE_SETTLE_REJECTED",
        code: validationCode,
        requirementNetwork: paymentRequirements.network,
        requirementAsset: paymentRequirements.asset,
        requirementAmount: paymentRequirements.amount
      });
      return { type: "payment-rejected", code: validationCode, response: this.buildValidationResponse(validationCode, paymentRequirements) };
    }

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
      return { type: "payment-required", response: settleResult.response };
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

  /**
   * The canonical list of x402-protected routes and their accepted payment terms.
   * Both the 402 flow ({@link buildRoutesConfig}) and the public discovery endpoint
   * ({@link getDiscovery}) derive from this single source, so the accepts advertised in
   * a 402 response and in discovery can never drift apart.
   */
  getCanonicalRoutes(): X402CanonicalRoute[] {
    return [
      {
        route: X402_TOP_UP_ROUTE,
        description: "Top up Akash Console credits with a USDC payment",
        mimeType: "application/json",
        accepts: {
          scheme: "exact",
          network: this.config.X402_NETWORK,
          payTo: this.config.X402_PAY_TO_ADDRESS!,
          maxTimeoutSeconds: 300,
          currency: "USD",
          minAmountUsd: this.config.X402_MIN_TOP_UP_USD,
          maxAmountUsd: this.config.X402_MAX_TOP_UP_USD
        }
      }
    ];
  }

  /** Public discovery document listing every x402 resource and its accepted payments. */
  getDiscovery(): X402DiscoveryResult {
    return {
      x402Version: 2,
      resources: this.getCanonicalRoutes().map(route => ({
        resource: route.route,
        description: route.description,
        mimeType: route.mimeType,
        accepts: [
          {
            scheme: route.accepts.scheme,
            network: route.accepts.network,
            payTo: route.accepts.payTo,
            currency: route.accepts.currency,
            minAmountUsd: route.accepts.minAmountUsd,
            maxAmountUsd: route.accepts.maxAmountUsd,
            maxTimeoutSeconds: route.accepts.maxTimeoutSeconds
          }
        ]
      }))
    };
  }

  private buildRoutesConfig(): RoutesConfig {
    const routes: Record<string, RouteConfig> = {};

    for (const route of this.getCanonicalRoutes()) {
      routes[route.route] = {
        description: route.description,
        mimeType: route.mimeType,
        accepts: {
          scheme: route.accepts.scheme,
          network: route.accepts.network,
          payTo: route.accepts.payTo,
          price: context => `$${this.parseAmount(context)}`,
          maxTimeoutSeconds: route.accepts.maxTimeoutSeconds
        }
      };
    }

    return routes;
  }

  private getHttpServer(): x402HTTPResourceServer {
    this.httpServer ??= this.httpServerFactory.create({
      facilitatorUrl: this.config.X402_FACILITATOR_URL,
      network: this.config.X402_NETWORK,
      routes: this.buildRoutesConfig()
    });

    return this.httpServer;
  }

  /**
   * Defence-in-depth guardrail run after the facilitator verifies a payment but before we
   * settle it on-chain. The verified requirement about to be settled must match the network
   * we advertise and must exactly match the terms the payer actually authorized. A mismatch
   * means we never call {@link x402HTTPResourceServer.processSettlement}, so a payment for the
   * wrong network, wrong asset, or a different amount is never settled or credited.
   */
  private validatePreSettle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): X402ValidationCode | undefined {
    const authorized = paymentPayload.accepted;

    if (paymentRequirements.network !== this.config.X402_NETWORK || authorized.network !== paymentRequirements.network) {
      return "WRONG_NETWORK";
    }

    if (authorized.asset !== paymentRequirements.asset) {
      return "WRONG_ASSET";
    }

    if (authorized.amount !== paymentRequirements.amount) {
      return "AMOUNT_MISMATCH";
    }

    return undefined;
  }

  private buildValidationResponse(code: X402ValidationCode, paymentRequirements: PaymentRequirements): HTTPResponseInstructions {
    return {
      status: 402,
      headers: {},
      body: {
        x402Version: 2,
        error: code,
        accepts: [paymentRequirements]
      }
    };
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
