import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import {
  ACCOUNT_STATUS_CONFLICT_ERROR_CODE,
  type AccountStatusAction,
  type AccountStatusActor,
  nextAccountStatusOf
} from "@src/user/lib/account-status/account-status";
import {
  type AccountStatusEventInput,
  type AccountStatusEventOutput,
  AccountStatusEventRepository
} from "@src/user/repositories/account-status-event/account-status-event.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import {
  CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS,
  CloseAccountDeployments,
  closeAccountDeploymentsKeyFor
} from "@src/user/services/close-account-deployments/close-account-deployments.job";

export type SuspendAccountInput = { actor: AccountStatusActor; userReason: string; internalNote?: string; closeDeployments: boolean };

export type ReinstateAccountInput = { actor: AccountStatusActor; note?: string };

type EventDetails = Pick<AccountStatusEventInput, "userReason" | "internalNote" | "options">;

@singleton()
export class AccountStatusService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly accountStatusEventRepository: AccountStatusEventRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AccountStatusService.name });
  }

  async suspend(userId: string, { actor, userReason, internalNote, closeDeployments }: SuspendAccountInput): Promise<AccountStatusEventOutput> {
    return await this.txService.transaction(async () => {
      const event = await this.#transition(userId, "suspend", actor, { userReason, internalNote: internalNote || null, options: { closeDeployments } });

      if (closeDeployments) {
        await this.jobQueueService.enqueue(new CloseAccountDeployments({ userId }), {
          singletonKey: closeAccountDeploymentsKeyFor(userId),
          ...CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS
        });
      }

      return event;
    });
  }

  async reinstate(userId: string, { actor, note }: ReinstateAccountInput): Promise<AccountStatusEventOutput> {
    return await this.txService.transaction(
      async () => await this.#transition(userId, "reinstate", actor, { userReason: null, internalNote: note || null, options: {} })
    );
  }

  async findEventsOf(userId: string): Promise<AccountStatusEventOutput[]> {
    return await this.accountStatusEventRepository.findManyByUserId(userId);
  }

  /** Only the reason an admin wrote for the user is returned, never the internal note. */
  async findUserReasonOf(user: Pick<UserOutput, "id" | "accountStatus">): Promise<string | null> {
    if (user.accountStatus === "active") return null;

    return await this.accountStatusEventRepository.findLatestUserReasonOf(user.id);
  }

  async #transition(userId: string, action: AccountStatusAction, actor: AccountStatusActor, details: EventDetails): Promise<AccountStatusEventOutput> {
    const user = await this.userRepository.findOneByAndLock({ id: userId });

    if (!user) throw createError(404, "User not found");

    const nextStatus = nextAccountStatusOf(user.accountStatus, action);

    if (!nextStatus) {
      throw createError(409, `Cannot ${action} an account that is ${user.accountStatus}`, {
        errorCode: ACCOUNT_STATUS_CONFLICT_ERROR_CODE,
        data: { accountStatus: user.accountStatus }
      });
    }

    await this.userRepository.updateById(userId, { accountStatus: nextStatus });
    const event = await this.accountStatusEventRepository.create({
      userId,
      userEmail: user.email,
      action,
      actorStaffId: actor.staffId ?? null,
      actorEmail: actor.email,
      actorName: actor.name,
      ...details
    });

    this.logger.info({ event: "ACCOUNT_STATUS_CHANGED", userId, action, from: user.accountStatus, to: nextStatus, eventId: event.id, actorEmail: actor.email });

    return event;
  }
}
