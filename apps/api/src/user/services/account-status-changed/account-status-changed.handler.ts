import { inject, singleton } from "tsyringe";

import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { type AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import {
  APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS,
  ApplyAccountTermination,
  applyAccountTerminationKeyFor
} from "@src/user/services/apply-account-termination/apply-account-termination.job";
import {
  CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS,
  CloseAccountDeployments,
  closeAccountDeploymentsKeyFor
} from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusChanged } from "./account-status-changed.job";

type UserAccountStatusEvent = AccountStatusEventOutput & { userId: string };

@singleton()
export class AccountStatusChangedHandler implements JobHandler<AccountStatusChanged> {
  public readonly accepts = AccountStatusChanged;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly accountStatusEventRepository: AccountStatusEventRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AccountStatusChangedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ eventId }: JobPayload<AccountStatusChanged>): Promise<void> {
    const event = await this.accountStatusEventRepository.findById(eventId);

    if (!event?.userId) {
      this.logger.info({ event: "ACCOUNT_STATUS_CHANGE_SKIPPED", reason: event ? "USER_DELETED" : "EVENT_NOT_FOUND", eventId });
      return;
    }

    const userEvent: UserAccountStatusEvent = { ...event, userId: event.userId };
    await this.txService.transaction(async () => await this.#enqueueFollowUpsOf(userEvent));
  }

  /** Auto-recharge checks stop rescheduling themselves while an account is suspended, so a reinstatement queues the next one. */
  async #enqueueFollowUpsOf(event: UserAccountStatusEvent): Promise<void> {
    if (event.action === "suspend" && event.options.closeDeployments) await this.#closeDeploymentsOf(event.userId);
    if (event.action === "reinstate") await this.walletReloadJobService.scheduleImmediate({ userId: event.userId });
    if (event.action === "terminate") await this.#applyTerminationOf(event.userId, event.options.forfeitCredits ?? false);
  }

  async #closeDeploymentsOf(userId: string): Promise<void> {
    await this.jobQueueService.enqueue(new CloseAccountDeployments({ userId }), {
      singletonKey: closeAccountDeploymentsKeyFor(userId),
      ...CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS
    });
  }

  async #applyTerminationOf(userId: string, forfeitCredits: boolean): Promise<void> {
    await this.jobQueueService.enqueue(new ApplyAccountTermination({ userId, forfeitCredits }), {
      singletonKey: applyAccountTerminationKeyFor(userId),
      ...APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS
    });
  }
}
