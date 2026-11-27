import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { StripeService, TRIAL_CARD_SETUP_INTENT_MARK } from "@src/billing/services/stripe/stripe.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { UserOutput } from "@src/user/repositories";
import { hashCard } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import { TrialCardRepository } from "@src/workload-abuse/repositories/trial-card/trial-card.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export const TRIAL_CARD_REFUSALS = {
  trial_card_not_verified: "This card has not been verified yet. Add it again to start your free trial.",
  trial_card_unsupported: "Only a credit or debit card can start the free trial.",
  trial_card_prepaid: "A prepaid card can't start the free trial. Use a credit or debit card, or add credits instead.",
  trial_card_already_used: "This card has already started a free trial. You can still add credits to deploy."
} as const;

export type TrialCardRefusal = keyof typeof TRIAL_CARD_REFUSALS;

/** An allowlist, so a card whose funding Stripe cannot tell is refused along with the prepaid ones. */
const TRIAL_CARD_FUNDINGS = ["credit", "debit"];

type CardHolder = Pick<UserOutput, "id" | "stripeCustomerId">;

@singleton()
export class TrialCardService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly trialCardRepository: TrialCardRepository,
    private readonly stripeService: StripeService,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialCardService.name });
  }

  isOffered(): boolean {
    return this.config.get("WORKLOAD_ABUSE_HELD_TRIAL_CARD_STEP") === "on";
  }

  /** False while the step is off, so switching it off puts every held account back behind its hold. */
  async hasVerifiedCard(userId: UserOutput["id"]): Promise<boolean> {
    return this.isOffered() && (await this.trialCardRepository.existsForUser(userId));
  }

  /** Spends the card on the user's trial: a credit or debit card the issuer verified through a trial card setup intent, never used for another account's trial. */
  async verify(user: CardHolder, setupIntentId: string): Promise<void> {
    if (!this.isOffered()) throw createError(404, "Not Found");

    const card = await this.#findVerifiedCard(user, setupIntentId);
    if (card.funding === "prepaid") this.#refuse(user, "trial_card_prepaid");
    if (!TRIAL_CARD_FUNDINGS.includes(card.funding)) this.#refuse(user, "trial_card_unsupported");

    const claim = await this.trialCardRepository.claim({
      cardHash: hashCard(this.config.get("WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET"), card.fingerprint),
      userId: user.id
    });
    if (claim.userId !== user.id) this.#refuse(user, "trial_card_already_used");

    this.logger.info({ event: "TRIAL_CARD_VERIFIED", userId: user.id });
  }

  async #findVerifiedCard(user: CardHolder, setupIntentId: string): Promise<{ fingerprint: string; funding: string }> {
    const setupIntent = await this.#findSetupIntentOf(user, setupIntentId);
    const isVerified = setupIntent.status === "succeeded" && setupIntent.metadata?.[TRIAL_CARD_SETUP_INTENT_MARK] === "true";
    if (!isVerified) this.#refuse(user, "trial_card_not_verified");

    const paymentMethod = typeof setupIntent.payment_method === "string" ? null : setupIntent.payment_method;
    const card = paymentMethod?.type === "card" ? paymentMethod.card : undefined;
    if (!card?.fingerprint) this.#refuse(user, "trial_card_unsupported");

    return { fingerprint: card.fingerprint, funding: card.funding };
  }

  /** Answers 404 for an intent of another customer as for one that does not exist, so the route confirms nothing about either. */
  async #findSetupIntentOf(user: CardHolder, setupIntentId: string): Promise<Stripe.SetupIntent> {
    const setupIntent = await this.#retrieveSetupIntent(setupIntentId);
    const customerId = typeof setupIntent?.customer === "string" ? setupIntent.customer : setupIntent?.customer?.id;

    if (!setupIntent || !user.stripeCustomerId || customerId !== user.stripeCustomerId) throw createError(404, "Setup intent not found");

    return setupIntent;
  }

  async #retrieveSetupIntent(setupIntentId: string): Promise<Stripe.SetupIntent | undefined> {
    try {
      return await this.stripeService.retrieveSetupIntentWithPaymentMethod(setupIntentId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return undefined;

      throw error;
    }
  }

  #refuse(user: CardHolder, refusal: TrialCardRefusal): never {
    this.logger.info({ event: "TRIAL_CARD_REFUSED", userId: user.id, refusal });

    throw createError(422, TRIAL_CARD_REFUSALS[refusal], { errorCode: refusal });
  }
}
