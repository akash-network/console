import type { LoggerService } from "@akashnetwork/logging";
import type { AnyAbility } from "@casl/ability";
import assert from "http-assert";
import difference from "lodash/difference";
import keyBy from "lodash/keyBy";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { extractFingerprint } from "@src/billing/lib/payment-method/extract-fingerprint";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { PaymentMethodRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY, WithTransaction } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { assertIsPayingUser, type PayingUser } from "../paying-user/paying-user";

export type PaymentMethod = Stripe.PaymentMethod & { validated: boolean; isDefault: boolean };

@singleton()
export class PaymentMethodService {
  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly userRepository: UserRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: PaymentMethodService.name });
  }

  async getPaymentMethods(userId: string, customerId: string, ability: AnyAbility): Promise<PaymentMethod[]> {
    const [remotes, locals] = await Promise.all([
      this.stripe.paymentMethods.list({ customer: customerId }),
      this.paymentMethodRepository.accessibleBy(ability, "read").findByUserId(userId)
    ]);

    const localById = keyBy(locals, "paymentMethodId");
    const remoteIds: string[] = [];

    const merged = remotes.data
      .map(remote => {
        remoteIds.push(remote.id);
        return {
          ...remote,
          validated: !!localById[remote.id]?.isValidated,
          isDefault: !!localById[remote.id]?.isDefault
        };
      })
      .sort((a, b) => b.created - a.created);

    const outOfSyncIds = difference(remoteIds, Object.keys(localById));

    if (outOfSyncIds.length) {
      this.loggerService.warn({
        event: "STRIPE_PAYMENT_METHOD_OUT_OF_SYNC",
        userId,
        outOfSyncIds
      });
    }

    return merged;
  }

  async getDefaultPaymentMethod(user: PayingUser, ability: AnyAbility): Promise<PaymentMethod | undefined> {
    const [customer, local] = await Promise.all([
      this.stripe.customers.retrieve(user.stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"]
      }),
      this.paymentMethodRepository.accessibleBy(ability, "read").findDefaultByUserId(user.id)
    ]);

    assert(!customer.deleted, 402, "Payment account has been deleted");

    const remote = customer.invoice_settings.default_payment_method;

    if (typeof remote === "object" && remote && local) {
      return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
    } else {
      this.loggerService.warn({
        event: "STRIPE_PAYMENT_METHOD_OUT_OF_SYNC",
        userId: user.id,
        remoteId: typeof remote === "string" ? remote : remote?.id,
        localId: local?.paymentMethodId
      });
    }
  }

  async hasPaymentMethod(paymentMethodId: string, user: UserOutput): Promise<boolean> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;

      return customerId === user.stripeCustomerId;
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
        return false;
      }

      throw error;
    }
  }

  @WithTransaction()
  async markPaymentMethodAsDefault(paymentMethodId: string, user: PayingUser, ability: AnyAbility): Promise<PaymentMethod> {
    const [local, remote] = await Promise.all([
      this.paymentMethodRepository.accessibleBy(ability, "update").markAsDefault(paymentMethodId),
      this.stripe.paymentMethods.retrieve(paymentMethodId, undefined, { timeout: 3_000 })
    ]);

    assert(remote, 404, "Payment method not found", { source: "stripe" });

    if (local) {
      await this.markRemotePaymentMethodAsDefault(paymentMethodId, user);
      return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
    }

    const fingerprint = extractFingerprint(remote);

    assert(fingerprint, 403, "Payment method cannot be set as default. No identifiable fingerprint found.");

    const newLocal = await this.paymentMethodRepository.accessibleBy(ability, "create").createAsDefault({
      userId: user.id,
      fingerprint,
      paymentMethodId
    });

    await this.markRemotePaymentMethodAsDefault(paymentMethodId, user);

    return { ...remote, validated: newLocal.isValidated, isDefault: newLocal.isDefault };
  }

  async markRemotePaymentMethodAsDefault(paymentMethodId: string, user: PayingUser): Promise<void> {
    await this.stripe.customers.update(
      user.stripeCustomerId,
      {
        invoice_settings: { default_payment_method: paymentMethodId }
      },
      { timeout: 3_000 }
    );
  }

  async syncAttachedFromEvent(event: Stripe.PaymentMethodAttachedEvent): Promise<void> {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer as string;

    if (!customerId) {
      this.loggerService.error({
        event: "PAYMENT_METHOD_MISSING_CUSTOMER_ID",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.loggerService.error({
        event: "USER_NOT_FOUND_FOR_PAYMENT_METHOD",
        customerId,
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    assertIsPayingUser(user);

    const result = await this.syncAttached({ user, paymentMethod });
    if (!result) {
      return;
    }

    this.loggerService.info({
      event: "PAYMENT_METHOD_ATTACHED",
      paymentMethodId: paymentMethod.id,
      userId: user.id,
      isDefault: result.isDefault,
      wasAlreadyProcessed: !result.isNew
    });
  }

  async removeDetachedFromEvent(event: Stripe.PaymentMethodDetachedEvent): Promise<void> {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer || event.data.previous_attributes?.customer;

    if (!customerId) {
      this.loggerService.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_CUSTOMER_ID",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const currentUser = await this.userRepository.findOneBy({ stripeCustomerId: customerId as string });
    if (!currentUser) {
      this.loggerService.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_USER",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const deleted = await this.removeDetached({ userId: currentUser.id, paymentMethod });

    this.loggerService.info({
      event: "PAYMENT_METHOD_DETACHED",
      paymentMethodId: paymentMethod.id,
      deleted
    });
  }

  @WithTransaction()
  async syncAttached(params: { user: PayingUser; paymentMethod: Stripe.PaymentMethod }): Promise<{ isNew: boolean; isDefault: boolean } | undefined> {
    const { user, paymentMethod } = params;

    const fingerprint = extractFingerprint(paymentMethod);
    if (!fingerprint) {
      this.loggerService.error({
        event: "PAYMENT_METHOD_MISSING_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });
      return;
    }

    // Use upsert for idempotency - handles Stripe webhook retries gracefully
    const { paymentMethod: localPaymentMethod, isNew } = await this.paymentMethodRepository.upsert({
      userId: user.id,
      fingerprint,
      paymentMethodId: paymentMethod.id
    });

    // Only set as default on Stripe if newly created AND is the first payment method (default)
    if (isNew && localPaymentMethod.isDefault) {
      try {
        await this.markRemotePaymentMethodAsDefault(paymentMethod.id, user);
      } catch (error) {
        // Log but don't fail - local record exists, Stripe sync can be retried manually if needed
        this.loggerService.warn({
          event: "STRIPE_DEFAULT_PAYMENT_METHOD_SYNC_FAILED",
          paymentMethodId: paymentMethod.id,
          userId: user.id,
          error
        });
      }
    }

    return { isNew, isDefault: localPaymentMethod.isDefault };
  }

  @WithTransaction()
  async removeDetached(params: { userId: string; paymentMethod: Stripe.PaymentMethod }): Promise<boolean> {
    const { userId, paymentMethod } = params;

    const fingerprint = extractFingerprint(paymentMethod);
    if (!fingerprint) {
      this.loggerService.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });
      return false;
    }

    const deletedPaymentMethod = await this.paymentMethodRepository.deleteByFingerprint(fingerprint, paymentMethod.id, userId);

    return !!deletedPaymentMethod;
  }

  async validatePaymentMethodAfter3DS(customerId: string, paymentMethodId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      const paymentIntentCustomerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;
      assert(paymentIntentCustomerId === customerId, 403, "Payment intent does not belong to the user");

      const paymentIntentPaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : paymentIntent.payment_method?.id;
      assert(paymentIntentPaymentMethodId === paymentMethodId, 403, "Payment intent does not reference the provided payment method");

      if (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture") {
        await this.markPaymentMethodAsValidated(customerId, paymentMethodId, paymentIntentId);

        this.loggerService.info({
          event: "PAYMENT_METHOD_VALIDATED_AFTER_3DS",
          customerId,
          paymentMethodId,
          paymentIntentId,
          status: paymentIntent.status
        });

        return { success: true };
      }

      this.loggerService.warn({
        event: "PAYMENT_INTENT_NOT_SUCCESSFUL_AFTER_3DS",
        customerId,
        paymentMethodId,
        paymentIntentId,
        status: paymentIntent.status
      });

      return { success: false };
    } catch (error) {
      this.loggerService.error({
        event: "FAILED_TO_CHECK_PAYMENT_INTENT_AFTER_3DS",
        customerId,
        paymentMethodId,
        paymentIntentId,
        error
      });
      throw error;
    }
  }

  private async markPaymentMethodAsValidated(customerId: string, paymentMethodId: string, paymentIntentId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
      if (!user) {
        this.loggerService.error({
          event: "USER_NOT_FOUND_FOR_VALIDATION",
          customerId,
          paymentMethodId
        });
        return;
      }

      await this.paymentMethodRepository.markAsValidated(paymentMethodId, user.id);
      this.loggerService.info({
        event: "PAYMENT_METHOD_VALIDATED",
        customerId,
        userId: user.id,
        paymentMethodId,
        paymentIntentId
      });
    } catch (error) {
      this.loggerService.error({
        event: "PAYMENT_METHOD_VALIDATION_UPDATE_FAILED",
        customerId,
        paymentMethodId,
        error
      });
      throw error;
    }
  }
}
