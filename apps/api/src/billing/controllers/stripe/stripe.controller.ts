import { HTTPException } from "hono/http-exception";
import assert from "http-assert";
import Stripe from "stripe";
import { singleton } from "tsyringe";
import type { infer as ZodInfer } from "zod";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { StripePricesOutputResponse } from "@src/billing";
import type {
  PaymentMethodMarkAsDefaultInput,
  PaymentMethodResponse,
  PaymentMethodsResponse,
  UpdateCustomerOrganizationRequest
} from "@src/billing/http-schemas/stripe.schema";
import {
  ApplyCouponRequest,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  CustomerTransactionsCsvExportQuerySchema,
  Transaction
} from "@src/billing/http-schemas/stripe.schema";
import type { StripeTransactionOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { CouponRedemptionService } from "@src/billing/services/coupon-redemption/coupon-redemption.service";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TopUpService } from "@src/billing/services/top-up/top-up.service";
import { TransactionReportingService } from "@src/billing/services/transaction-reporting/transaction-reporting.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { WalletSettingService } from "@src/billing/services/wallet-settings/wallet-settings.service";
import { LoggerService } from "@src/core/providers/logging.provider";

@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly stripeTransaction: StripeTransactionService,
    private readonly topUpService: TopUpService,
    private readonly authService: AuthService,
    private readonly stripeErrorService: StripeErrorService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly trialActivationJobService: TrialActivationJobService,
    private readonly transactionReporting: TransactionReportingService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly couponRedemptionService: CouponRedemptionService,
    private readonly customerService: CustomerService,
    private readonly walletSettingService: WalletSettingService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(StripeController.name);
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<{ data: { clientSecret: string | null } }> {
    const { currentUser } = this.authService;

    const stripeCustomerId = await this.customerService.getStripeCustomerId(currentUser);
    const userWallet = await this.userWalletRepository.findOneByUserId(currentUser.id);
    const isFreeTrial = userWallet?.isTrialing ?? true;

    const setupIntent = await this.stripe.createSetupIntent(stripeCustomerId, { isFreeTrial });
    return { data: { clientSecret: setupIntent.client_secret } };
  }

  @Protected([{ action: "update", subject: "PaymentMethod" }])
  async markAsDefault(input: PaymentMethodMarkAsDefaultInput): Promise<void> {
    const { ability } = this.authService;
    const currentUser = this.authService.getCurrentPayingUser();

    await this.paymentMethodService.markPaymentMethodAsDefault(input.data.id, currentUser, ability);
  }

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getDefaultPaymentMethod(): Promise<PaymentMethodResponse> {
    const { ability } = this.authService;
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    if (!currentUser) {
      throw new HTTPException(404, {
        message: "PaymentMethod not found",
        cause: "User does not have a Stripe customer ID"
      });
    }

    const paymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(currentUser, ability);

    assert(paymentMethod, 404, "PaymentMethod not found");

    return { data: paymentMethod };
  }

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    if (currentUser) {
      const paymentMethods = await this.paymentMethodService.getPaymentMethods(currentUser, this.authService.ability);
      return { data: paymentMethods };
    }

    return { data: [] };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirmPayment(params: ConfirmPaymentRequest["data"]): Promise<ConfirmPaymentResponse> {
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    assert(currentUser, 500, "Payment account not properly configured. Please contact support.");

    try {
      const data = await this.topUpService.topUp(currentUser, {
        amount: params.amount,
        paymentMethodId: params.paymentMethodId,
        idempotencyKey: params.idempotencyKey,
        awaitResolved: params.awaitResolved
      });

      return { data };
    } catch (error) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async applyCoupon(params: ApplyCouponRequest["data"]): Promise<{
    data: {
      coupon: Stripe.Coupon | Stripe.PromotionCode | null;
      amountAdded?: number;
      transactionId?: string;
      transactionStatus?: StripeTransactionOutput["status"];
      error?: { message: string };
    };
  }> {
    const { currentUser } = this.authService;

    assert(params.couponId, 400, "Coupon ID is required");
    assert(params.userId, 400, "User ID is required");

    const userWallet = await this.userWalletRepository.findOneByUserId(currentUser.id);
    await this.trialActivationJobService.assertActivated({ userId: currentUser.id, activatedAt: userWallet?.activatedAt });

    try {
      const result = await this.couponRedemptionService.redeemCoupon(currentUser, params.couponId);

      if (params.awaitResolved) {
        const transaction = await this.stripeTransaction.resolveTransaction(result.transactionId);
        return { data: { coupon: result.coupon, amountAdded: result.amountAdded, transactionId: result.transactionId, transactionStatus: transaction.status } };
      }

      return {
        data: { coupon: result.coupon, amountAdded: result.amountAdded, transactionId: result.transactionId, transactionStatus: result.transactionStatus }
      };
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "coupon")) {
        return { data: this.stripeErrorService.toCouponResponseError(error) };
      }

      throw error;
    }
  }

  @Protected([{ action: "delete", subject: "StripePayment" }])
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    try {
      // Verify payment method ownership
      const paymentMethod = await this.stripe.retrievePaymentMethod(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      assert(customerId === currentUser.stripeCustomerId, 403, "Payment method does not belong to the user");

      const wasDefault = await this.paymentMethodService.isDefaultPaymentMethod(paymentMethodId, currentUser.id);

      await this.stripe.detachPaymentMethod(paymentMethodId);

      if (wasDefault) {
        await this.#disableAutoReloadAfterDefaultRemoval(currentUser.id);
      }
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }
  }

  /**
   * The Stripe detach already succeeded and can't be replayed (a retry 403s on the now customer-less
   * method), so a failed auto reload disable must not fail the request. The stale "enabled with no
   * default card" state self-heals on the next default payment method read.
   */
  async #disableAutoReloadAfterDefaultRemoval(userId: string): Promise<void> {
    try {
      await this.walletSettingService.disableAutoReload(userId);
    } catch (error) {
      this.logger.error({ event: "AUTO_RELOAD_DISABLE_AFTER_REMOVAL_FAILED", userId, error });
    }
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async getCustomerTransactions(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: { transactions: Transaction[]; totalCount: number; hasMore: boolean } }> {
    const { currentUser } = this.authService;

    const response = await this.transactionReporting.getCustomerTransactions(currentUser.id, options);
    return { data: response };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async exportTransactionsCsvStream(options: ZodInfer<typeof CustomerTransactionsCsvExportQuerySchema>): Promise<AsyncIterable<string>> {
    const { currentUser } = this.authService;

    return this.transactionReporting.exportTransactionsCsvStream(currentUser.id, options);
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async validatePaymentMethodAfter3DS({
    data: { paymentMethodId, paymentIntentId }
  }: {
    data: { paymentMethodId: string; paymentIntentId: string };
  }): Promise<{ success: boolean }> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 400, "Payment method is not configured for this user");

    try {
      // Verify payment method ownership
      const paymentMethod = await this.stripe.retrievePaymentMethod(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      assert(customerId === currentUser.stripeCustomerId, 403, "Payment method does not belong to the user");

      return await this.paymentMethodService.validatePaymentMethodAfter3DS(currentUser.stripeCustomerId, paymentMethodId, paymentIntentId);
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async updateCustomerOrganization(input: UpdateCustomerOrganizationRequest): Promise<void> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 400, "Payment method is not configured for this user");

    await this.customerService.updateCustomerOrganization(currentUser.stripeCustomerId, input.organization);
  }
}
