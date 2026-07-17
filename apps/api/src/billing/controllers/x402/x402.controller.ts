import type { HTTPRequestContext } from "@x402/core/server";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { X402TransactionListQuery, X402TransactionListResponse } from "@src/billing/http-schemas/x402.schema";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { X402TransactionRepository } from "@src/billing/repositories/x402-transaction/x402-transaction.repository";
import type { X402TopUpProcessResult } from "@src/billing/services/x402/x402.service";
import { X402Service } from "@src/billing/services/x402/x402.service";
import { X402_ERROR_CODES } from "@src/billing/services/x402/x402-error-codes";

@singleton()
export class X402Controller {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly x402Service: X402Service,
    private readonly x402TransactionRepository: X402TransactionRepository,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "create", subject: "X402Payment" }])
  async topUp(context: HTTPRequestContext, amountUsd: number): Promise<X402TopUpProcessResult> {
    if (!this.x402Service.isEnabled) {
      throw createError(404, "x402 payments are not enabled", { data: { errorCode: X402_ERROR_CODES.X402_DISABLED } });
    }

    if (amountUsd < this.config.X402_MIN_TOP_UP_USD || amountUsd > this.config.X402_MAX_TOP_UP_USD) {
      throw createError(400, `Top-up amount must be between ${this.config.X402_MIN_TOP_UP_USD} and ${this.config.X402_MAX_TOP_UP_USD} USD`, {
        data: { errorCode: X402_ERROR_CODES.AMOUNT_OUT_OF_BOUNDS }
      });
    }

    const { currentUser } = this.authService;

    return await this.x402Service.processTopUp(context, currentUser.id, amountUsd);
  }

  @Protected([{ action: "read", subject: "X402Payment" }])
  async listTransactions(query: X402TransactionListQuery): Promise<X402TransactionListResponse> {
    const { currentUser, ability } = this.authService;

    const { transactions, total } = await this.x402TransactionRepository
      .accessibleBy(ability, "read")
      .findByUserPaginated({ userId: currentUser.id, limit: query.limit, offset: query.offset });

    return {
      data: transactions.map(transaction => ({
        transactionId: transaction.id,
        status: transaction.status,
        amountUsdCents: transaction.amount,
        currency: transaction.currency,
        network: transaction.network,
        asset: transaction.asset,
        settlementTxHash: transaction.settlementTxHash,
        payerAddress: transaction.payerAddress,
        createdAt: transaction.createdAt.toISOString()
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total
      }
    };
  }
}
