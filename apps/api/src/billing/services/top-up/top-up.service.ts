import assert from "http-assert";
import { singleton } from "tsyringe";

import type { ConfirmPaymentResponse } from "@src/billing/http-schemas/stripe.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";

/**
 * Namespace prefix added to a client attempt key so a top-up idempotency key can never collide with
 * another flow's. The full key is `topup_<userId>_<clientAttemptKey>`.
 */
export const TOP_UP_IDEMPOTENCY_KEY_PREFIX = "topup_";

@singleton()
export class TopUpService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly trialActivationJobService: TrialActivationJobService,
    private readonly trialValidationService: TrialValidationService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly stripeTransactionService: StripeTransactionService
  ) {}

  /**
   * Runs the user-initiated top-up: trial-activation gating, top-up amount validation, payment-method
   * ownership, and a confirmed charge through the payment-transaction owner, followed by 3DS/success
   * interpretation and (optionally) settlement resolution.
   *
   * Amount-mismatch policy: `reject`. Reusing an attempt key whose recorded amount differs from the
   * requested one is treated as a definitive client error. The client rotates its key whenever the
   * amount changes, so a changed amount on a reused key means a stale or misbehaving client — never a
   * legitimate re-attempt of the same charge.
   */
  async topUp(
    currentUser: PayingUser,
    params: { amount: number; paymentMethodId: string; idempotencyKey?: string; awaitResolved?: boolean }
  ): Promise<ConfirmPaymentResponse["data"]> {
    const userWallet = await this.userWalletRepository.findOneByUserId(currentUser.id);
    await this.trialActivationJobService.assertActivated({ userId: currentUser.id, activatedAt: userWallet?.activatedAt });
    this.trialValidationService.validateTopUpAmount(userWallet, params.amount);

    assert(await this.paymentMethodService.hasPaymentMethod(params.paymentMethodId, currentUser), 403, "Payment method does not belong to the user");

    const result = await this.stripeTransactionService.createPaymentIntent({
      userId: currentUser.id,
      customer: currentUser.stripeCustomerId,
      payment_method: params.paymentMethodId,
      amount: params.amount,
      confirm: true,
      idempotencyKey: params.idempotencyKey ? `${TOP_UP_IDEMPOTENCY_KEY_PREFIX}${currentUser.id}_${params.idempotencyKey}` : undefined,
      onAmountMismatch: "reject"
    });

    if (result.requiresAction && result.clientSecret && result.paymentIntentId) {
      return {
        success: false,
        requiresAction: true,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        transactionId: result.transactionId,
        transactionStatus: result.transactionStatus
      };
    }

    if (!result.success) {
      throw new Error("Payment not successful");
    }

    if (params.awaitResolved) {
      const transaction = await this.stripeTransactionService.resolveTransaction(result.transactionId);
      return { success: true, transactionId: result.transactionId, transactionStatus: transaction.status };
    }

    return { success: true, transactionId: result.transactionId, transactionStatus: result.transactionStatus };
  }
}
