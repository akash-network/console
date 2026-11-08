import { singleton } from "tsyringe";

import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";

@singleton()
export class AccountStatusService {
  constructor(private readonly accountStatusEventRepository: AccountStatusEventRepository) {}

  /** Only the reason an admin wrote for the user is returned, never the internal note. */
  async findUserReasonOf(user: Pick<UserOutput, "id" | "accountStatus">): Promise<string | null> {
    if (user.accountStatus === "active") return null;

    return await this.accountStatusEventRepository.findLatestUserReasonOf(user.id);
  }
}
