import assert from "http-assert";
import { singleton } from "tsyringe";

import type { ConfirmPaymentResponse } from "@src/billing/http-schemas/stripe.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { PayingPayer } from "@src/billing/services/payer/payer";
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";

/**
 * Namespace prefix added to a client attempt key so a top-up idempotency key can never collide with
 * another flow's. The full key is `topup_<userId>_<clientAttemptKey>`.
 */
export const TOP_UP_IDEMPOTENCY_KEY_PREFIX = "topup_";

/** A team organization's top-up gets its own namespace, `org_topup_<organizationId>_<userId>_<clientAttemptKey>`, so no user key changes. */
export const TEAM_TOP_UP_IDEMPOTENCY_KEY_PREFIX = "org_topup_";

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
    payer: PayingPayer,
    params: { amount: number; paymentMethodId: string; idempotencyKey?: string; awaitResolved?: boolean }
  ): Promise<ConfirmPaymentResponse["data"]> {
    const userWallet = await this.userWalletRepository.findOneUsedBy(payer.user.id);

    if (!payer.team) {
      await this.trialActivationJobService.assertActivated({ userId: payer.user.id, activatedAt: userWallet?.activatedAt });
    }

    this.trialValidationService.validateTopUpAmount(userWallet, params.amount);

    assert(await this.paymentMethodService.hasPaymentMethod(params.paymentMethodId, payer), 403, "Payment method does not belong to the user");

    const result = await this.stripeTransactionService.createPaymentIntent({
      userId: payer.user.id,
      organizationId: payer.organizationId,
      customer: payer.stripeCustomerId,
      payment_method: params.paymentMethodId,
      amount: params.amount,
      confirm: true,
      idempotencyKey: params.idempotencyKey && this.#idempotencyKeyOf(payer, params.idempotencyKey),
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

  #idempotencyKeyOf(payer: PayingPayer, clientAttemptKey: string): string {
    if (payer.team) {
      return `${TEAM_TOP_UP_IDEMPOTENCY_KEY_PREFIX}${payer.team.id}_${payer.user.id}_${clientAttemptKey}`;
    }

    return `${TOP_UP_IDEMPOTENCY_KEY_PREFIX}${payer.user.id}_${clientAttemptKey}`;
  }
}
