import { inject, singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { InviteAffiliate, inviteAffiliateKeyFor } from "./invite-affiliate.job";

/** Invites everyone who already spent enough to join the referral program; people who cross the line later see the join entry in the app instead. */
@singleton()
export class AffiliateInvitationCatchUpService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly jobQueueService: JobQueueService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateInvitationCatchUpService.name });
  }

  async run({ dryRun }: { dryRun: boolean }): Promise<{ invited: number }> {
    const userIds = await this.stripeTransactionRepository.findUserIdsWithNetCardSpendAtLeast(this.billingConfig.AFFILIATE_SELF_JOIN_MIN_SPEND_AMOUNT);
    const invited = dryRun ? userIds.length : await this.#enqueueInvitations(userIds);

    this.#logger.info({ event: "AFFILIATE_INVITATION_CATCH_UP", invited, dryRun });

    return { invited };
  }

  async #enqueueInvitations(userIds: string[]): Promise<number> {
    let enqueued = 0;

    for (const userId of userIds) {
      if (await this.jobQueueService.enqueue(new InviteAffiliate({ userId }), { singletonKey: inviteAffiliateKeyFor(userId) })) enqueued += 1;
    }

    return enqueued;
  }
}
