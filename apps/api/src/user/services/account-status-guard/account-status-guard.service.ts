import { singleton } from "tsyringe";

import { createAccountStatusRefusal } from "@src/user/lib/account-status/account-status";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { AccountStatusService } from "@src/user/services/account-status/account-status.service";

@singleton()
export class AccountStatusGuard {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly accountStatusService: AccountStatusService
  ) {}

  async assertMaySpend(user: Pick<UserOutput, "id" | "accountStatus">): Promise<void> {
    if (user.accountStatus === "active") return;

    throw createAccountStatusRefusal(user.accountStatus, await this.accountStatusService.findUserReasonOf(user));
  }

  /** A user that no longer exists is left to the checks that need one, so only a found suspended or terminated account is refused. */
  async assertUserMaySpend(userId: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (user) await this.assertMaySpend(user);
  }

  async maySpend(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id: userId });

    return !user || user.accountStatus === "active";
  }
}
