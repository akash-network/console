import type { LoggerService } from "@akashnetwork/logging";
import type { AnyAbility } from "@casl/ability";
import assert from "http-assert";
import keyBy from "lodash/keyBy";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { extractFingerprint } from "@src/billing/lib/payment-method/extract-fingerprint";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { type PaymentMethodOutput, PaymentMethodRepository } from "@src/billing/repositories";
import { AutoReloadPauseService } from "@src/billing/services/auto-reload-pause/auto-reload-pause.service";
import { billingOwnerOf, type Payer, type PayingPayer } from "@src/billing/services/payer/payer";
import { billingOwnerOfCustomer, PayerService } from "@src/billing/services/payer/payer.service";
import { type CreateLogger, LOGGER_FACTORY, WithTransaction } from "@src/core";

export type PaymentMethod = Stripe.PaymentMethod & { validated: boolean; isDefault: boolean };

/** Who a payment method row is written for: the member who acted, the organization billed and the owner whose payment methods it joins. */
export interface PaymentMethodHolder {
  userId: string;
  organizationId?: string;
  owner: BillingOwner;
}

export function paymentMethodHolderOf(payer: Payer): PaymentMethodHolder {
  return { userId: payer.user.id, organizationId: payer.organizationId, owner: billingOwnerOf(payer) };
}

const STRIPE_RETRIEVE_TIMEOUT_MS = 3_000;

function getCustomerId(paymentMethod: Stripe.PaymentMethod): string | undefined {
  return typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
}

function isResourceMissing(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";
}

@singleton()
export class PaymentMethodService {
  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly payerService: PayerService,
    private readonly autoReloadPauseService: AutoReloadPauseService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: PaymentMethodService.name });
  }

  async getPaymentMethods(payer: PayingPayer, ability: AnyAbility): Promise<PaymentMethod[]> {
    const [remotes, locals] = await Promise.all([
      this.stripe.paymentMethods.list({ customer: payer.stripeCustomerId }),
      this.paymentMethodRepository.accessibleBy(ability, "read").findByOwner(billingOwnerOf(payer))
    ]);

    const reconciledLocals = await this.#reconcilePaymentMethods({ holder: paymentMethodHolderOf(payer), ability, remotes, locals });
    const localById = keyBy(reconciledLocals, "paymentMethodId");

    const merged = remotes.data
      .map(remote => ({
        ...remote,
        validated: !!localById[remote.id]?.isValidated,
        isDefault: !!localById[remote.id]?.isDefault
      }))
      .sort((a, b) => b.created - a.created);

    const unsyncableIds = remotes.data.filter(remote => !localById[remote.id] && !extractFingerprint(remote)).map(remote => remote.id);

    if (unsyncableIds.length) {
      this.loggerService.warn({
        event: "STRIPE_PAYMENT_METHOD_OUT_OF_SYNC",
        userId: payer.user.id,
        outOfSyncIds: unsyncableIds
      });
    }

    return merged;
  }

  async #reconcilePaymentMethods(params: {
    holder: PaymentMethodHolder;
    ability: AnyAbility;
    remotes: Stripe.ApiList<Stripe.PaymentMethod>;
    locals: PaymentMethodOutput[];
  }): Promise<PaymentMethodOutput[]> {
    const { holder, ability, remotes, locals } = params;
    const remoteIds = new Set(remotes.data.map(remote => remote.id));

    const staleRemoved = await this.#removeStaleLocalPaymentMethods({ holder, locals, remoteIds, hasMore: remotes.has_more });
    const repaired = await this.#repairUnsyncedRemotePaymentMethods({ holder, remotes: remotes.data, locals });

    if (!staleRemoved && !repaired) {
      return locals;
    }

    return this.paymentMethodRepository.accessibleBy(ability, "read").findByOwner(holder.owner);
  }

  /**
   * Deletes local rows whose payment method is absent from Stripe, e.g. left over from a missed
   * payment_method.detached webhook. Stale rows inflate countByUserId and break first-card default
   * detection on the next add. Guarded on !hasMore because Stripe pages the list at 10: against a
   * truncated page a still-attached method would be wrongly deleted.
   */
  async #removeStaleLocalPaymentMethods(params: {
    holder: PaymentMethodHolder;
    locals: PaymentMethodOutput[];
    remoteIds: Set<string>;
    hasMore: boolean;
  }): Promise<boolean> {
    const {
      holder: { userId, owner },
      locals,
      remoteIds,
      hasMore
    } = params;

    if (hasMore) {
      return false;
    }

    const stale = locals.filter(local => !remoteIds.has(local.paymentMethodId));

    if (!stale.length) {
      return false;
    }

    const removedIds: string[] = [];

    for (const local of stale) {
      try {
        await this.paymentMethodRepository.deleteByFingerprint(local.fingerprint, local.paymentMethodId, owner);
        removedIds.push(local.paymentMethodId);
      } catch (error) {
        this.loggerService.error({
          event: "PAYMENT_METHOD_STALE_REMOVE_FAILED",
          userId,
          paymentMethodId: local.paymentMethodId,
          error
        });
      }
    }

    if (removedIds.length) {
      this.loggerService.info({
        event: "PAYMENT_METHOD_STALE_REMOVED",
        userId,
        paymentMethodIds: removedIds
      });
    }

    return removedIds.length > 0;
  }

  /** Heals a missed payment_method.attached webhook on read, oldest first so the genuine first card wins the default. */
  async #repairUnsyncedRemotePaymentMethods(params: { holder: PaymentMethodHolder; remotes: Stripe.PaymentMethod[]; locals: PaymentMethodOutput[] }): Promise<boolean> {
    const { holder, remotes, locals } = params;
    const localIds = new Set(locals.map(local => local.paymentMethodId));
    const unsynced = remotes.filter(remote => !localIds.has(remote.id) && extractFingerprint(remote)).sort((a, b) => a.created - b.created);

    if (!unsynced.length) {
      return false;
    }

    const repairedIds: string[] = [];

    for (const remote of unsynced) {
      try {
        await this.syncAttached({ holder, paymentMethod: remote });
        repairedIds.push(remote.id);
      } catch (error) {
        this.loggerService.error({
          event: "PAYMENT_METHOD_READ_REPAIR_FAILED",
          userId: holder.userId,
          paymentMethodId: remote.id,
          error
        });
      }
    }

    if (repairedIds.length) {
      this.loggerService.info({
        event: "PAYMENT_METHOD_READ_REPAIRED",
        userId: holder.userId,
        paymentMethodIds: repairedIds
      });
    }

    return repairedIds.length > 0;
  }

  async getDefaultPaymentMethod(payer: PayingPayer, ability: AnyAbility): Promise<PaymentMethod | undefined> {
    const local = await this.paymentMethodRepository.accessibleBy(ability, "read").findDefaultByOwner(billingOwnerOf(payer));

    if (!local) {
      return;
    }

    const remote = await this.#retrieveAttachedPaymentMethod(local.paymentMethodId, payer.stripeCustomerId, { timeout: STRIPE_RETRIEVE_TIMEOUT_MS });

    if (!remote) {
      this.loggerService.warn({
        event: "DEFAULT_PAYMENT_METHOD_NOT_ATTACHED",
        userId: payer.user.id,
        paymentMethodId: local.paymentMethodId
      });
      return;
    }

    return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
  }

  async isDefaultPaymentMethod(paymentMethodId: string, owner: BillingOwner): Promise<boolean> {
    const local = await this.paymentMethodRepository.findOneOwnedBy(owner, paymentMethodId);

    return !!local?.isDefault;
  }

  async hasPaymentMethod(paymentMethodId: string, payer: Pick<Payer, "stripeCustomerId">): Promise<boolean> {
    return !!(await this.#retrieveAttachedPaymentMethod(paymentMethodId, payer.stripeCustomerId));
  }

  async #retrieveAttachedPaymentMethod(
    paymentMethodId: string,
    stripeCustomerId: Payer["stripeCustomerId"],
    options?: Stripe.RequestOptions
  ): Promise<Stripe.PaymentMethod | undefined> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId, undefined, options);

      return getCustomerId(paymentMethod) === stripeCustomerId ? paymentMethod : undefined;
    } catch (error: unknown) {
      if (isResourceMissing(error)) {
        return undefined;
      }

      throw error;
    }
  }

  @WithTransaction()
  async markPaymentMethodAsDefault(paymentMethodId: string, payer: PayingPayer, ability: AnyAbility): Promise<PaymentMethod> {
    const remote = await this.#retrieveAttachedPaymentMethod(paymentMethodId, payer.stripeCustomerId, { timeout: STRIPE_RETRIEVE_TIMEOUT_MS });

    assert(remote, 404, "Payment method not found", { source: "stripe" });

    const local = await this.paymentMethodRepository.accessibleBy(ability, "update").markAsDefault(paymentMethodId);

    if (local) {
      return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
    }

    const fingerprint = extractFingerprint(remote);

    assert(fingerprint, 403, "Payment method cannot be set as default. No identifiable fingerprint found.");

    const newLocal = await this.paymentMethodRepository.accessibleBy(ability, "create").createAsDefault({
      userId: payer.user.id,
      organizationId: payer.organizationId,
      fingerprint,
      paymentMethodId
    });

    return { ...remote, validated: newLocal.isValidated, isDefault: newLocal.isDefault };
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

    const customerOwner = await this.payerService.findByStripeCustomerId(customerId);
    if (!customerOwner) {
      this.loggerService.error({
        event: "USER_NOT_FOUND_FOR_PAYMENT_METHOD",
        customerId,
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    if ("team" in customerOwner) {
      this.#deferTeamPaymentMethodSync(customerOwner.team.id, paymentMethod.id);
      return;
    }

    const { user, personalOrganizationId } = customerOwner;
    const result = await this.syncAttached({ holder: { userId: user.id, organizationId: personalOrganizationId, owner: { userId: user.id } }, paymentMethod });
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

  /** No member acts in a webhook, so the read of a team's payment methods that follows adding one records it under the member reading. */
  #deferTeamPaymentMethodSync(organizationId: string, paymentMethodId: string) {
    this.loggerService.info({ event: "TEAM_PAYMENT_METHOD_ATTACHED", organizationId, paymentMethodId });
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

    const customerOwner = await this.payerService.findByStripeCustomerId(customerId as string);
    if (!customerOwner) {
      this.loggerService.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_USER",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const deleted = await this.removeDetached({ owner: billingOwnerOfCustomer(customerOwner), paymentMethod });

    this.loggerService.info({
      event: "PAYMENT_METHOD_DETACHED",
      paymentMethodId: paymentMethod.id,
      deleted
    });
  }

  @WithTransaction()
  async syncAttached(params: { holder: PaymentMethodHolder; paymentMethod: Stripe.PaymentMethod }): Promise<{ isNew: boolean; isDefault: boolean } | undefined> {
    const { holder, paymentMethod } = params;

    const fingerprint = extractFingerprint(paymentMethod);
    if (!fingerprint) {
      this.loggerService.error({
        event: "PAYMENT_METHOD_MISSING_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });
      return;
    }

    const { paymentMethod: localPaymentMethod, isNew } = await this.paymentMethodRepository.upsert({
      ...holder,
      fingerprint,
      paymentMethodId: paymentMethod.id
    });

    if (isNew && localPaymentMethod.isDefault && "userId" in holder.owner) {
      await this.#resumeAutoReloadAfterDefaultChange(holder.owner.userId);
    }

    return { isNew, isDefault: localPaymentMethod.isDefault };
  }

  /**
   * Runs inside the upsert transaction, so a thrown resume would roll back the payment method row
   * this webhook exists to record and leave Stripe retrying a delivery that already did its job.
   */
  async #resumeAutoReloadAfterDefaultChange(userId: string): Promise<void> {
    try {
      await this.autoReloadPauseService.resume(userId);
    } catch (error) {
      this.loggerService.error({ event: "AUTO_RELOAD_RESUME_AFTER_ATTACH_FAILED", userId, error });
    }
  }

  @WithTransaction()
  async removeDetached(params: { owner: BillingOwner; paymentMethod: Stripe.PaymentMethod }): Promise<boolean> {
    const { owner, paymentMethod } = params;

    const fingerprint = extractFingerprint(paymentMethod);
    if (!fingerprint) {
      this.loggerService.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });
      return false;
    }

    return await this.paymentMethodRepository.deleteByFingerprint(fingerprint, paymentMethod.id, owner);
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
      const customerOwner = await this.payerService.findByStripeCustomerId(customerId);
      if (!customerOwner) {
        this.loggerService.error({
          event: "USER_NOT_FOUND_FOR_VALIDATION",
          customerId,
          paymentMethodId
        });
        return;
      }

      const owner = billingOwnerOfCustomer(customerOwner);
      await this.paymentMethodRepository.markAsValidated(paymentMethodId, owner);
      this.loggerService.info({
        event: "PAYMENT_METHOD_VALIDATED",
        customerId,
        ...owner,
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
