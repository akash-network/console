import { LoggerService } from "@akashnetwork/logging";
import { PromisePool } from "@supercharge/promise-pool";
import difference from "lodash/difference";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { UserRepository } from "@src/user/repositories";
import { UserConfigService } from "@src/user/services/user-config/user-config.service";

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

  async cleanUpStaleAnonymousUsers() {
    await this.userRepository.paginateStaleAnonymousUsers(
      { inactivityInDays: this.config.get("STALE_ANONYMOUS_USERS_LIVE_IN_DAYS"), limit: this.CONCURRENCY },
      async users => {
        const userIds = users.map(user => user.id);
        const wallets = await this.userWalletRepository.findByUserId(users.map(user => user.id));
        const { errors } = await PromisePool.withConcurrency(this.CONCURRENCY)
          .for(wallets)
          .process(async wallet => {
            await this.managedUserWalletService.revokeAll(wallet.address, "USER_INACTIVITY");
          });
        const erroredUserIds = errors.map(({ item }) => item.userId);
        const userIdsToRemove = difference(userIds, erroredUserIds);

        if (userIdsToRemove.length) {
          await this.userRepository.deleteById(userIdsToRemove);
          this.logger.debug({ event: "STALE_ANONYMOUS_USERS_CLEANUP", userIds: userIdsToRemove });
        }

        if (errors.length) {
          this.logger.debug({ event: "STALE_ANONYMOUS_USERS_REVOKE_ERROR", errors });
          this.sentry.captureEvent(this.sentryEventService.toEvent(errors));
        }
      }
    );
  }
}
