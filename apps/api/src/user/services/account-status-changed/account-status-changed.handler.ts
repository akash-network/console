import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { type AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
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

  async #enqueueFollowUpsOf(event: UserAccountStatusEvent): Promise<void> {
    if (event.action === "suspend" && event.options.closeDeployments) {
      await this.jobQueueService.enqueue(new CloseAccountDeployments({ userId: event.userId }), {
        singletonKey: closeAccountDeploymentsKeyFor(event.userId),
        ...CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS
      });
    }
  }
}
