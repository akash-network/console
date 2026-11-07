import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
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
  APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS,
  ApplyAccountTermination,
  applyAccountTerminationKeyFor
} from "@src/user/services/apply-account-termination/apply-account-termination.job";
import {
  CLOSE_ACCOUNT_DEPLOYMENTS_RETRY_OPTIONS,
  CloseAccountDeployments,
  closeAccountDeploymentsKeyFor
} from "@src/user/services/close-account-deployments/close-account-deployments.job";

export type SuspendAccountInput = { actor: AccountStatusActor; userReason: string; internalNote?: string; closeDeployments: boolean };

export type ReinstateAccountInput = { actor: AccountStatusActor; note?: string };

export type TerminateAccountInput = { actor: AccountStatusActor; userReason: string; internalNote?: string; forfeitCredits: boolean };

type EventDetails = Pick<AccountStatusEventInput, "userReason" | "internalNote" | "options">;

/** Marks the events Console records on its own, such as an account terminated for signing up with a terminated account's email. */
export const SYSTEM_ACCOUNT_STATUS_ACTOR = { email: "system", name: "Console" } as const satisfies AccountStatusActor;

@singleton()
export class AccountStatusService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly accountStatusEventRepository: AccountStatusEventRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly walletReloadJobService: WalletReloadJobService,
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

  /** Auto-recharge checks stop rescheduling themselves while an account is suspended, so reinstating queues the next one. */
  async reinstate(userId: string, { actor, note }: ReinstateAccountInput): Promise<AccountStatusEventOutput> {
    return await this.txService.transaction(async () => {
      const event = await this.#transition(userId, "reinstate", actor, { userReason: null, internalNote: note || null, options: {} });
      await this.walletReloadJobService.scheduleImmediate({ userId });

      return event;
    });
  }

  async terminate(userId: string, { actor, userReason, internalNote, forfeitCredits }: TerminateAccountInput): Promise<AccountStatusEventOutput> {
    return await this.txService.transaction(async () => {
      const event = await this.#transition(userId, "terminate", actor, { userReason, internalNote: internalNote || null, options: { forfeitCredits } });

      await this.#enqueueTerminationEffects(userId, forfeitCredits);

      return event;
    });
  }

  /** Call it whenever an address becomes verified, since accounts are keyed on the sign-in identity and one verified late may already run deployments or auto-recharge. */
  async terminateIfVerifiedEmailWasTerminated(user: UserOutput): Promise<UserOutput> {
    if (user.accountStatus !== "active" || !user.emailVerified || !user.email) return user;

    const termination = await this.accountStatusEventRepository.findLatestVerifiedTerminationOf(user.email);

    if (!termination) return user;

    await this.txService.transaction(async () => {
      await this.#transition(user.id, "terminate", SYSTEM_ACCOUNT_STATUS_ACTOR, {
        userReason: termination.userReason,
        internalNote: null,
        options: { forfeitCredits: false, ...(termination.userId && { matchedUserId: termination.userId }) }
      });
      await this.#enqueueTerminationEffects(user.id, false);
    });

    return { ...user, accountStatus: "terminated" };
  }

  async #enqueueTerminationEffects(userId: string, forfeitCredits: boolean): Promise<void> {
    await this.jobQueueService.enqueue(new ApplyAccountTermination({ userId, forfeitCredits }), {
      singletonKey: applyAccountTerminationKeyFor(userId),
      ...APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS
    });
  }

  async findEventsOf(userId: string): Promise<AccountStatusEventOutput[]> {
    return await this.accountStatusEventRepository.findManyByUserId(userId);
  }

  /** Only the reason an admin wrote for the user is returned, never the internal note. */
  async findUserReasonOf(user: Pick<UserOutput, "id" | "accountStatus">): Promise<string | null> {
    if (user.accountStatus === "active") return null;

    return await this.accountStatusEventRepository.findLatestUserReasonOf(user.id);
  }

  /** A termination records whether the address was verified then, since only a verified one is carried over to accounts signing up under it. */
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
      ...details,
      options: action === "terminate" ? { ...details.options, emailVerified: user.emailVerified } : details.options
    });

    this.logger.info({ event: "ACCOUNT_STATUS_CHANGED", userId, action, from: user.accountStatus, to: nextStatus, eventId: event.id, actorEmail: actor.email });

    return event;
  }
}
