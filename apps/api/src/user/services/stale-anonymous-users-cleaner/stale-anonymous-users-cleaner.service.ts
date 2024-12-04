import { LoggerService } from "@akashnetwork/logging";
import { PromisePool } from "@supercharge/promise-pool";
import difference from "lodash/difference";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { DryRunOptions } from "@src/core/types/console";
import { UserRepository } from "@src/user/repositories";
import { StaleAnonymousUsersCleanerSummarizer } from "@src/user/services/stale-anonymous-users-cleaner-summarizer/stale-anonymous-users-cleaner-summarizer.service";
import { UserConfigService } from "@src/user/services/user-config/user-config.service";

export interface StaleAnonymousUsersCleanerOptions extends DryRunOptions {}

@singleton()
export class StaleAnonymousUsersCleanerService {
  private readonly CONCURRENCY = 10;

  private readonly logger = LoggerService.forContext(StaleAnonymousUsersCleanerService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly config: UserConfigService,
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {}

  async cleanUpStaleAnonymousUsers(options: StaleAnonymousUsersCleanerOptions) {
    const summary = new StaleAnonymousUsersCleanerSummarizer();
    await this.userRepository.paginateStaleAnonymousUsers(
      { inactivityInDays: this.config.get("STALE_ANONYMOUS_USERS_LIVE_IN_DAYS"), limit: this.CONCURRENCY },
      async users => {
        const userIds = users.map(user => user.id);
        const wallets = await this.userWalletRepository.findByUserId(users.map(user => user.id));
        const { errors } = await PromisePool.withConcurrency(this.CONCURRENCY)
          .for(wallets)
          .process(async wallet => {
            const result = await this.managedUserWalletService.revokeAll(wallet.address, "USER_INACTIVITY", options);
            if (result.feeAllowance) {
              summary.inc("feeAllowanceRevokeCount");
            }
            if (result.deploymentGrant) {
              summary.inc("deploymentGrantRevokeCount");
            }
          });
        const erroredUserIds = errors.map(({ item }) => item.userId);
        const userIdsToRemove = difference(userIds, erroredUserIds);

        if (errors.length) {
          summary.inc("revokeErrorCount", errors.length);
          this.logger.debug({ event: "STALE_ANONYMOUS_USERS_REVOKE_ERROR", errors });
          this.sentry.captureEvent(this.sentryEventService.toEvent(errors));
        }

        if (userIdsToRemove.length) {
          if (!options.dryRun) {
            await this.userRepository.deleteById(userIdsToRemove);
          }
          summary.inc("usersDroppedCount", userIdsToRemove.length);
        }
        this.logger.debug({ event: "STALE_ANONYMOUS_USERS_CLEANUP", userIds: userIdsToRemove, summary: summary.summarize(), dryRun: options.dryRun });
      }
    );
  }
}
