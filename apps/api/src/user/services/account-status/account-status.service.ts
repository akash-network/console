import { inject, singleton } from "tsyringe";

import { type CreateLogger, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { type AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import {
  APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS,
  ApplyAccountTermination,
  applyAccountTerminationKeyFor
} from "@src/user/services/apply-account-termination/apply-account-termination.job";

type MatchedTermination = Pick<AccountStatusEventOutput, "userId" | "userReason">;

/** Marks the events Console records on its own, such as an account terminated for signing up with a terminated account's email. */
const SYSTEM_ACCOUNT_STATUS_ACTOR = { email: "system", name: "Console" } as const;

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

  /** Call it whenever an address becomes verified, since accounts are keyed on the sign-in identity and one verified late may already run deployments or auto-recharge. */
  async terminateIfVerifiedEmailWasTerminated(user: UserOutput): Promise<UserOutput> {
    if (user.accountStatus !== "active" || !user.emailVerified || !user.email) return user;

    const termination = await this.accountStatusEventRepository.findLatestVerifiedTerminationOf(user.email);

    if (!termination) return user;

    await this.txService.transaction(async () => await this.#terminateMatching(user.id, termination));

    return { ...user, accountStatus: "terminated" };
  }

  async #terminateMatching(userId: string, termination: MatchedTermination): Promise<void> {
    const user = await this.userRepository.findOneByAndLock({ id: userId });

    if (!user || user.accountStatus === "terminated") return;

    await this.userRepository.updateById(userId, { accountStatus: "terminated" });
    const event = await this.accountStatusEventRepository.create({
      userId,
      userEmail: user.email,
      action: "terminate",
      actorStaffId: null,
      actorEmail: SYSTEM_ACCOUNT_STATUS_ACTOR.email,
      actorName: SYSTEM_ACCOUNT_STATUS_ACTOR.name,
      userReason: termination.userReason,
      internalNote: null,
      options: { forfeitCredits: false, emailVerified: user.emailVerified, ...(termination.userId && { matchedUserId: termination.userId }) }
    });
    await this.jobQueueService.enqueue(new ApplyAccountTermination({ userId, forfeitCredits: false }), {
      singletonKey: applyAccountTerminationKeyFor(userId),
      ...APPLY_ACCOUNT_TERMINATION_RETRY_OPTIONS
    });

    this.logger.info({
      event: "ACCOUNT_STATUS_CHANGED",
      userId,
      action: "terminate",
      from: user.accountStatus,
      to: "terminated",
      eventId: event.id,
      actorEmail: SYSTEM_ACCOUNT_STATUS_ACTOR.email
    });
  }

  /** Only the reason an admin wrote for the user is returned, never the internal note. */
  async findUserReasonOf(user: Pick<UserOutput, "id" | "accountStatus">): Promise<string | null> {
    if (user.accountStatus === "active") return null;

    return await this.accountStatusEventRepository.findLatestUserReasonOf(user.id);
  }
}
