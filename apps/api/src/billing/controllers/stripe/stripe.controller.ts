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
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
@singleton()
export class StripeController {
  constructor(
    private readonly stripe: StripeService,
    private readonly authService: AuthService,
    private readonly stripeErrorService: StripeErrorService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "read", subject: "StripePayment" }])
  async findPrices(): Promise<StripePricesOutputResponse> {
    return { data: await this.stripe.findPrices() };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async createSetupIntent(): Promise<{ data: { clientSecret: string | null } }> {
    const { currentUser } = this.authService;

    const stripeCustomerId = await this.stripe.getStripeCustomerId(currentUser);

    const setupIntent = await this.stripe.createSetupIntent(stripeCustomerId);
    return { data: { clientSecret: setupIntent.client_secret } };
  }

  @Protected([{ action: "update", subject: "PaymentMethod" }])
  async markAsDefault(input: PaymentMethodMarkAsDefaultInput): Promise<void> {
    const { ability } = this.authService;
    const currentUser = this.authService.getCurrentPayingUser();

    await this.stripe.markPaymentMethodAsDefault(input.data.id, currentUser, ability);
  }

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getDefaultPaymentMethod(): Promise<PaymentMethodResponse> {
    const { ability } = this.authService;
    const currentUser = this.authService.getCurrentPayingUser();
    const paymentMethod = await this.stripe.getDefaultPaymentMethod(currentUser, ability);

    assert(paymentMethod, 404, "PaymentMethod not found");

    return { data: paymentMethod };
  }

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    if (currentUser) {
      const paymentMethods = await this.stripe.getPaymentMethods(currentUser.id, currentUser.stripeCustomerId, this.authService.ability);
      return { data: paymentMethods };
    }

    return { data: [] };
  }

  @Protected([{ action: "create", subject: "StripePayment" }])
  async confirmPayment(params: ConfirmPaymentRequest["data"]): Promise<ConfirmPaymentResponse> {
    const currentUser = this.authService.getCurrentPayingUser({ strict: false });

    assert(currentUser, 500, "Payment account not properly configured. Please contact support.");

    try {
      assert(await this.stripe.hasPaymentMethod(params.paymentMethodId, currentUser), 403, "Payment method does not belong to the user");

      const result = await this.stripe.createPaymentIntent({
        userId: currentUser.id,
        customer: currentUser.stripeCustomerId,
        payment_method: params.paymentMethodId,
        amount: params.amount,
        currency: params.currency,
        confirm: true
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
        const transaction = await this.stripe.resolveTransaction(result.transactionId);
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

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");
    assert(params.couponId, 400, "Coupon ID is required");
    assert(params.userId, 400, "User ID is required");

    try {
      const result = await this.stripe.applyCoupon(currentUser, params.couponId);

      if (params.awaitResolved) {
        const transaction = await this.stripe.resolveTransaction(result.transactionId);
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

    const userWallet = await this.userWalletRepository.findOneByUserId(currentUser.id);

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");
    assert(!(userWallet && userWallet.isTrialing), 403, "Cannot remove payment method during trial. Please contact support.");

    try {
      // Verify payment method ownership
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      assert(customerId === currentUser.stripeCustomerId, 403, "Payment method does not belong to the user");

      await this.stripe.paymentMethods.detach(paymentMethodId);
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
    startingAfter?: string;
    endingBefore?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: { transactions: Transaction[]; hasMore: boolean; nextPage: string | null; prevPage: string | null } }> {
    const { currentUser } = this.authService;

    if (!currentUser.stripeCustomerId) {
      return { data: { transactions: [], hasMore: false, nextPage: null, prevPage: null } };
    }

    const response = await this.stripe.getCustomerTransactions(currentUser.stripeCustomerId, options);
    return { data: response };
  }

  @Protected([{ action: "read", subject: "StripePayment" }])
  async exportTransactionsCsvStream(options: ZodInfer<typeof CustomerTransactionsCsvExportQuerySchema>): Promise<AsyncIterable<string>> {
    const { currentUser } = this.authService;

    assert(currentUser.stripeCustomerId, 403, "Payments are not configured. Please start with a trial first");

    return this.stripe.exportTransactionsCsvStream(currentUser.stripeCustomerId, options);
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
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
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
