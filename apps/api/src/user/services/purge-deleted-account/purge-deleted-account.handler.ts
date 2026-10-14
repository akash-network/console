import { inject, singleton } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import { type CreateLogger, type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";

/** Removes what a deleted account left outside the Console database, enqueued in the transaction that deletes the user. */
export class PurgeDeletedAccount implements Job {
  static readonly [JOB_NAME] = "PurgeDeletedAccount";
  readonly name = PurgeDeletedAccount[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      userId: string;
      auth0UserId: string | null;
      stripeCustomerId: string | null;
      personalOrganizationId?: string | null;
    }
  ) {}
}

/** Long enough to outlast a provider outage of a few hours, since a surviving Auth0 user can sign back in to a fresh account. */
export const PURGE_DELETED_ACCOUNT_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;

export type PurgeStep = "notifications" | "auth0" | "stripe";

@singleton()
export class PurgeDeletedAccountHandler implements JobHandler<PurgeDeletedAccount> {
  public readonly accepts = PurgeDeletedAccount;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly auth0Service: Auth0Service,
    private readonly customerService: CustomerService,
    private readonly analyticsService: AnalyticsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: PurgeDeletedAccountHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Every step is idempotent, so a retry after a partial failure safely repeats the steps that already succeeded. */
  async handle(payload: JobPayload<PurgeDeletedAccount>): Promise<void> {
    const { userId, auth0UserId, stripeCustomerId, personalOrganizationId = null } = payload;
    const failedSteps: PurgeStep[] = [];

    const runStep = async (step: PurgeStep, purge: () => Promise<void>) => {
      try {
        await purge();
      } catch (error) {
        failedSteps.push(step);
        this.logger.error({ event: "ACCOUNT_DELETION_CLEANUP_FAILED", userId, step, error });
        this.analyticsService.track(
          userId,
          "account_deletion_failed",
          { step, error_type: error instanceof Error ? error.name : typeof error },
          { insertId: `account_deletion_failed.${userId}.${step}` }
        );
      }
    };

    await runStep("notifications", () => this.notificationService.purgeUserData(userId, personalOrganizationId));
    if (auth0UserId) await runStep("auth0", () => this.auth0Service.deleteUser(auth0UserId));
    if (stripeCustomerId) await runStep("stripe", () => this.customerService.deleteCustomer(stripeCustomerId));

    if (failedSteps.length > 0) {
      throw new Error(`Account cleanup failed at: ${failedSteps.join(", ")}`);
    }

    this.logger.info({ event: "ACCOUNT_DELETION_CLEANUP_COMPLETED", userId });
  }
}
