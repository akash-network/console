import { createOtelLogger } from "@akashnetwork/logging/otel";
import type {
  HTTPProcessResult,
  HTTPRequestContext,
  HTTPResponseInstructions,
  PaymentCancellationDispatcher,
  ProcessSettleSuccessResponse,
  x402HTTPResourceServer
} from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { createHash } from "crypto";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type X402TransactionOutput, X402TransactionRepository } from "@src/billing/repositories/x402-transaction/x402-transaction.repository";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { X402_ERROR_CODES, type X402ErrorCode } from "@src/billing/services/x402/x402-error-codes";
import { X402HttpServerFactoryService } from "@src/billing/services/x402/x402-http-server-factory.service";
import { WithTransaction } from "@src/core";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import type { CreateDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

export const X402_TOP_UP_ROUTE = "POST /v1/x402/top-up";
export const X402_DEPLOY_ROUTE = "POST /v1/x402/deploy";

type PaymentVerifiedResult = Extract<HTTPProcessResult, { type: "payment-verified" }>;

/**
 * Outcome of settling an x402 payment and crediting the Console balance, shared by both the
 * top-up and pay-per-deploy flows. `credited` carries the transaction row so a follow-on step
 * (e.g. driving deployment creation) can key off it.
 */
type SettlementResult =
  | { type: "payment-required"; code: X402ErrorCode; response: HTTPResponseInstructions }
  | { type: "duplicate-payment"; transactionId: string }
  | { type: "credited"; transaction: X402TransactionOutput; headers: Record<string, string>; settlementTxHash: string; payerAddress?: string };

type AbuseLimitViolation = { type: "rate-limited"; retryAfterSeconds: number } | { type: "cost-ceiling-exceeded"; ceilingUsdCents: number };

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

export type X402DeployInput = { sdl: string; deposit: number };

export type X402DeploySuccessData = {
  transactionId: string;
  amountUsdCents: number;
  network: string;
  settlementTxHash: string;
  payerAddress?: string;
  deploymentDseq: string;
  manifest: string;
  signTx: CreateDeploymentResponse["data"]["signTx"];
};

export type X402DeployProcessResult =
  | { type: "payment-required"; code: X402ErrorCode; response: HTTPResponseInstructions }
  | { type: "duplicate-payment"; transactionId: string }
  | AbuseLimitViolation
  | {
      type: "deploy-failed";
      headers: Record<string, string>;
      transactionId: string;
      amountUsdCents: number;
      settlementTxHash: string;
      message: string;
    }
  | { type: "success"; headers: Record<string, string>; data: X402DeploySuccessData };

@singleton()
export class X402Service {
  private readonly logger = createOtelLogger({ context: X402Service.name });

  private httpServer?: x402HTTPResourceServer;

  private initPromise?: Promise<void>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly x402TransactionRepository: X402TransactionRepository,
    private readonly refillService: RefillService,
    private readonly httpServerFactory: X402HttpServerFactoryService,
    private readonly deploymentWriterService: DeploymentWriterService
  ) {}

  get isEnabled(): boolean {
    return this.config.X402_ENABLED === "true" && !!this.config.X402_PAY_TO_ADDRESS;
  }

  async processTopUp(context: HTTPRequestContext, userId: string, amountUsd: number): Promise<X402TopUpProcessResult> {
    const verified = await this.verifyPayment(context, "top-up");
    if (verified.type !== "payment-verified") {
      return verified;
    }

    const amountUsdCents = Math.round(amountUsd * 100);
    const settlement = await this.settlePaymentAndCredit(context, { userId, amountUsdCents }, verified);

    if (settlement.type === "payment-required" || settlement.type === "duplicate-payment") {
      return settlement;
    }

    const { transaction } = settlement;
    this.logger.info({
      event: "X402_TOP_UP_SUCCEEDED",
      transactionId: transaction.id,
      userId,
      amountUsdCents: transaction.amount,
      network: transaction.network,
      settlementTxHash: settlement.settlementTxHash
    });

    return {
      type: "success",
      headers: settlement.headers,
      data: {
        transactionId: transaction.id,
        amountUsdCents: transaction.amount,
        network: transaction.network,
        settlementTxHash: settlement.settlementTxHash,
        payerAddress: settlement.payerAddress
      }
    };
  }

  /**
   * Pay-per-deploy: one x402-paid call settles USDC, credits the Console balance through the same
   * `RefillService.topUpWallet` choke point as every other funding source, then drives the existing
   * managed deployment creation service with the freshly credited balance.
   *
   * If settlement + credit succeed but deployment creation fails, the funds remain in the user's
   * Console balance (never reversed on-chain): the row is flagged `deployFailed` and a `deploy-failed`
   * result is returned so the caller knows the money is spendable.
   */
  async processDeploy(context: HTTPRequestContext, userId: string, input: X402DeployInput): Promise<X402DeployProcessResult> {
    const verified = await this.verifyPayment(context, "deploy");
    if (verified.type !== "payment-verified") {
      return verified;
    }

    const amountUsdCents = Math.round(input.deposit * 100);

    // Abuse controls run on the verified (paying) request, before any on-chain settlement, so an
    // over-limit caller never has funds captured. Cancel the verified payment on rejection.
    const violation = await this.checkAbuseLimits(userId, amountUsdCents);
    if (violation) {
      await verified.cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: violation.type === "rate-limited" ? 429 : 402 });
      return violation;
    }

    const settlement = await this.settlePaymentAndCredit(context, { userId, amountUsdCents }, verified);
    if (settlement.type === "payment-required" || settlement.type === "duplicate-payment") {
      return settlement;
    }

    const { transaction } = settlement;

    try {
      const deployment = await this.deploymentWriterService.create({ sdl: input.sdl, deposit: input.deposit, userId });
      await this.x402TransactionRepository.linkDeployment(transaction.id, deployment.dseq);

      this.logger.info({
        event: "X402_DEPLOY_SUCCEEDED",
        transactionId: transaction.id,
        userId,
        amountUsdCents: transaction.amount,
        deploymentDseq: deployment.dseq,
        settlementTxHash: settlement.settlementTxHash
      });

      return {
        type: "success",
        headers: settlement.headers,
        data: {
          transactionId: transaction.id,
          amountUsdCents: transaction.amount,
          network: transaction.network,
          settlementTxHash: settlement.settlementTxHash,
          payerAddress: settlement.payerAddress,
          deploymentDseq: deployment.dseq,
          manifest: deployment.manifest,
          signTx: deployment.signTx
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment creation failed";
      await this.x402TransactionRepository.markDeployFailed(transaction.id, message);

      this.logger.error({
        event: "X402_DEPLOY_FAILED_FUNDS_CREDITED",
        transactionId: transaction.id,
        userId,
        amountUsdCents: transaction.amount,
        error
      });

      return {
        type: "deploy-failed",
        headers: settlement.headers,
        transactionId: transaction.id,
        amountUsdCents: transaction.amount,
        settlementTxHash: settlement.settlementTxHash,
        message
      };
    }
  }

  /**
   * Re-drives crediting for every transaction stranded in `settled` (captured on-chain but not yet
   * credited) past the configured threshold. Idempotent per row via the conditional credit gate, so
   * it is safe to run alongside in-request crediting and concurrent reconcile runs. Emits a backlog
   * count each run for observability.
   */
  async reconcileStaleSettled(): Promise<{ backlog: number; credited: number; failed: number }> {
    const cutoff = new Date(Date.now() - this.config.X402_RECONCILE_THRESHOLD_SECONDS * 1000);
    const stale = await this.x402TransactionRepository.findStaleSettled(cutoff, this.config.X402_RECONCILE_BATCH_SIZE);

    this.logger.info({
      event: "X402_RECONCILE_BACKLOG",
      backlog: stale.length,
      thresholdSeconds: this.config.X402_RECONCILE_THRESHOLD_SECONDS,
      cutoff: cutoff.toISOString()
    });

    let credited = 0;
    let failed = 0;

    for (const transaction of stale) {
      try {
        if (await this.creditSettledTransaction(transaction.id)) {
          credited++;
        }
      } catch (error) {
        failed++;
        this.logger.error({ event: "X402_RECONCILE_CREDIT_FAILED", transactionId: transaction.id, error });
      }
    }

    this.logger.info({ event: "X402_RECONCILE_COMPLETED", backlog: stale.length, credited, failed });

    return { backlog: stale.length, credited, failed };
  }

  private async verifyPayment(
    context: HTTPRequestContext,
    routeLabel: string
  ): Promise<PaymentVerifiedResult | { type: "payment-required"; code: X402ErrorCode; response: HTTPResponseInstructions }> {
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
      throw new Error(`x402 ${routeLabel} route is misconfigured: payment is always required`);
    }

    return result;
  }

  private async settlePaymentAndCredit(
    context: HTTPRequestContext,
    input: { userId: string; amountUsdCents: number },
    verified: PaymentVerifiedResult
  ): Promise<SettlementResult> {
    const httpServer = this.getHttpServer();
    const { paymentPayload, paymentRequirements, declaredExtensions, cancellationDispatcher } = verified;
    const paymentHash = this.hashPayment(paymentPayload);

    const existing = await this.x402TransactionRepository.findByPaymentHash(paymentHash);
    const resolvedExisting = await this.resolveTerminalOrSettled(existing, cancellationDispatcher);
    if (resolvedExisting) {
      return resolvedExisting;
    }

    // `existing` is now undefined or a resumable pending/failed attempt this request owns.
    let transaction: X402TransactionOutput;
    if (existing) {
      transaction = existing;
    } else {
      const created = await this.createTransaction(
        { userId: input.userId, amountUsdCents: input.amountUsdCents, paymentRequirements, paymentHash },
        cancellationDispatcher
      );
      if (created.type === "resolved") {
        return created.result;
      }
      transaction = created.transaction;
    }

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

    return {
      type: "credited",
      transaction,
      headers: this.pickPaymentResponseHeaders(settleResult),
      settlementTxHash: settleResult.transaction,
      payerAddress: settleResult.payer
    };
  }

  /**
   * Per-user abuse controls for the x402-paid endpoints, evaluated against the user's recent
   * (non-failed) x402 transactions within a rolling window: a request-count rate limit and a
   * cumulative-spend cost ceiling. Both are config-driven and need no extra infrastructure.
   */
  private async checkAbuseLimits(userId: string, amountUsdCents: number): Promise<AbuseLimitViolation | undefined> {
    const windowSeconds = this.config.X402_ABUSE_WINDOW_SECONDS;
    const since = new Date(Date.now() - windowSeconds * 1000);

    const recentCount = await this.x402TransactionRepository.countByUserSince(userId, since);
    if (recentCount >= this.config.X402_ABUSE_MAX_REQUESTS) {
      this.logger.warn({ event: "X402_RATE_LIMITED", userId, recentCount, max: this.config.X402_ABUSE_MAX_REQUESTS, windowSeconds });
      return { type: "rate-limited", retryAfterSeconds: windowSeconds };
    }

    const recentSpendCents = await this.x402TransactionRepository.sumAmountByUserSince(userId, since);
    const ceilingCents = Math.round(this.config.X402_ABUSE_MAX_SPEND_USD * 100);
    if (recentSpendCents + amountUsdCents > ceilingCents) {
      this.logger.warn({ event: "X402_COST_CEILING_EXCEEDED", userId, recentSpendCents, amountUsdCents, ceilingCents });
      return { type: "cost-ceiling-exceeded", ceilingUsdCents: ceilingCents };
    }

    return undefined;
  }

  private async resolveTerminalOrSettled(
    existing: X402TransactionOutput | undefined,
    cancellationDispatcher: PaymentCancellationDispatcher
  ): Promise<SettlementResult | undefined> {
    if (existing?.status === "succeeded") {
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 409 });
      return { type: "duplicate-payment", transactionId: existing.id };
    }

    if (existing?.status === "settled") {
      // Payment already settled on-chain but crediting was interrupted: resume it
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 409 });
      await this.creditSettledTransaction(existing.id);
      return {
        type: "credited",
        transaction: existing,
        headers: {},
        settlementTxHash: existing.settlementTxHash ?? "",
        payerAddress: existing.payerAddress ?? undefined
      };
    }

    return undefined;
  }

  private async createTransaction(
    input: { userId: string; amountUsdCents: number; paymentRequirements: PaymentRequirements; paymentHash: string },
    cancellationDispatcher: PaymentCancellationDispatcher
  ): Promise<{ type: "created"; transaction: X402TransactionOutput } | { type: "resolved"; result: SettlementResult }> {
    try {
      const transaction = await this.x402TransactionRepository.create({
        userId: input.userId,
        status: "pending",
        amount: input.amountUsdCents,
        currency: "usd",
        network: input.paymentRequirements.network,
        asset: input.paymentRequirements.asset,
        paymentHash: input.paymentHash
      });
      return { type: "created", transaction };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // The DB-level UNIQUE(payment_hash) index lost the insert race to a concurrent request for the
      // same payment. Re-read the winning row and resume/dedupe instead of surfacing a 500.
      this.logger.info({ event: "X402_PAYMENT_HASH_CONFLICT", paymentHash: input.paymentHash });
      const raced = await this.x402TransactionRepository.findByPaymentHash(input.paymentHash);
      const resolved = await this.resolveTerminalOrSettled(raced, cancellationDispatcher);
      if (resolved) {
        return { type: "resolved", result: resolved };
      }

      // The concurrent request is still mid-flight (pending/failed): do not settle the same payment
      // twice. Report it as a duplicate; crediting is guaranteed by that request or the reconcile job.
      await cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: 409 });
      return { type: "resolved", result: { type: "duplicate-payment", transactionId: raced!.id } };
    }
  }

  /**
   * Credits a settled transaction exactly once. Returns `true` only when this call performed the
   * credit; `false` when there was nothing to credit or another caller already claimed it.
   */
  @WithTransaction()
  private async creditSettledTransaction(transactionId: string): Promise<boolean> {
    const transaction = await this.x402TransactionRepository.findOneByAndLock({ id: transactionId });

    if (!transaction || transaction.status !== "settled") {
      return false;
    }

    // Atomic settled -> succeeded transition is the money-integrity gate: only the caller that wins
    // the conditional UPDATE credits the wallet. A concurrent retry or the reconcile job sees the
    // transition already claimed (rowCount 0) and returns without double-crediting.
    const transitioned = await this.x402TransactionRepository.markSettledAsSucceeded(transaction.id);

    if (!transitioned) {
      this.logger.info({ event: "X402_CREDIT_SKIPPED_ALREADY_CLAIMED", transactionId: transaction.id });
      return false;
    }

    await this.refillService.topUpWallet(transaction.amount, transaction.userId, {
      payment: {
        currency: transaction.currency,
        paymentMethodType: "x402",
        transactionId: transaction.id
      }
    });

    return true;
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
        },
        [X402_DEPLOY_ROUTE]: {
          description: "Create and fund an Akash deployment with a single USDC payment",
          mimeType: "application/json",
          accepts: {
            scheme: "exact",
            network: this.config.X402_NETWORK,
            payTo: this.config.X402_PAY_TO_ADDRESS!,
            price: context => this.parseDeposit(context),
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

  private async parseDeposit(context: HTTPRequestContext): Promise<string> {
    const body = (await context.adapter.getBody?.()) as { deposit?: unknown } | undefined;
    const deposit = Number(body?.deposit);

    if (!Number.isFinite(deposit) || deposit < this.config.X402_MIN_DEPLOY_USD || deposit > this.config.X402_MAX_DEPLOY_USD) {
      throw new Error(`x402 deploy deposit must be between ${this.config.X402_MIN_DEPLOY_USD} and ${this.config.X402_MAX_DEPLOY_USD} USD`);
    }

    return `$${deposit}`;
  }

  private hashPayment(paymentPayload: PaymentPayload): string {
    return createHash("sha256").update(JSON.stringify(paymentPayload.payload)).digest("hex");
  }

  private pickPaymentResponseHeaders(settleResult: ProcessSettleSuccessResponse): Record<string, string> {
    return settleResult.headers ?? {};
  }
}
