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
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { StripeService, TOP_UP_IDEMPOTENCY_KEY_PREFIX } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TransactionReportingService } from "@src/billing/services/transaction-reporting/transaction-reporting.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly stripeTransaction: StripeTransactionService,
    private readonly authService: AuthService,
    private readonly stripeErrorService: StripeErrorService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly trialValidationService: TrialValidationService,
    private readonly transactionReporting: TransactionReportingService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly couponRedemptionService: CouponRedemptionService
  ) {}

  @Protected([{ action: "read", subject: "StripePayment" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<{ data: { clientSecret: string | null } }> {
    const { currentUser } = this.authService;

    const stripeCustomerId = await this.stripe.getStripeCustomerId(currentUser);
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
      const paymentMethods = await this.paymentMethodService.getPaymentMethods(currentUser.id, currentUser.stripeCustomerId, this.authService.ability);
      return { data: paymentMethods };
    }

    return { data: [] };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirmPayment(params: ConfirmPaymentRequest["data"]): Promise<ConfirmPaymentResponse> {
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    assert(currentUser, 500, "Payment account not properly configured. Please contact support.");

    const userWallet = await this.userWalletRepository.findOneByUserId(currentUser.id);
    this.trialValidationService.validateTopUpAmount(userWallet, params.amount);

    try {
      assert(await this.paymentMethodService.hasPaymentMethod(params.paymentMethodId, currentUser), 403, "Payment method does not belong to the user");

      const result = await this.stripeTransaction.createPaymentIntent({
        userId: currentUser.id,
        customer: currentUser.stripeCustomerId,
        payment_method: params.paymentMethodId,
        amount: params.amount,
        confirm: true,
        idempotencyKey: params.idempotencyKey ? `${TOP_UP_IDEMPOTENCY_KEY_PREFIX}${currentUser.id}_${params.idempotencyKey}` : undefined,
        onAmountMismatch: "reject"
      });

      // Handle 3D Secure authentication requirement
      if (result.requiresAction && result.clientSecret && result.paymentIntentId) {
        return {
          data: {
            success: false,
            requiresAction: true,
            clientSecret: result.clientSecret,
            paymentIntentId: result.paymentIntentId,
            transactionId: result.transactionId,
            transactionStatus: result.transactionStatus
          }
        };
      }

      // If payment was not successful and it's not a 3D Secure case, throw an error
      if (!result.success) {
        throw new Error("Payment not successful");
      }

      if (params.awaitResolved) {
        const transaction = await this.stripeTransaction.resolveTransaction(result.transactionId);
        return { data: { success: true, transactionId: result.transactionId, transactionStatus: transaction.status } };
      }

      return { data: { success: true, transactionId: result.transactionId, transactionStatus: result.transactionStatus } };
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

      await this.stripe.detachPaymentMethod(paymentMethodId);
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
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

      return await this.stripe.validatePaymentMethodAfter3DS(currentUser.stripeCustomerId, paymentMethodId, paymentIntentId);
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

    await this.stripe.updateCustomerOrganization(currentUser.stripeCustomerId, input.organization);
  }
}
