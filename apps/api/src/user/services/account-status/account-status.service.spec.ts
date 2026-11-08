import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusService } from "./account-status.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountStatusService.name, () => {
  describe("findUserReasonOf", () => {
    it("returns null for an active account without reading the events", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "active" });

      expect(await service.findUserReasonOf(user)).toBeNull();
      expect(accountStatusEventRepository.findLatestUserReasonOf).not.toHaveBeenCalled();
    });

    it("returns the latest reason written for the user of a suspended account", async () => {
      const { service, user, accountStatusEventRepository } = setup({ accountStatus: "suspended" });
      accountStatusEventRepository.findLatestUserReasonOf.mockResolvedValue("Unpaid invoices");

      expect(await service.findUserReasonOf(user)).toBe("Unpaid invoices");
      expect(accountStatusEventRepository.findLatestUserReasonOf).toHaveBeenCalledWith(user.id);
    });
  });

  function setup(input: { accountStatus: AccountStatus }) {
    const user = createUser({ accountStatus: input.accountStatus });
    const accountStatusEventRepository = mock<AccountStatusEventRepository>();
    const service = new AccountStatusService(accountStatusEventRepository);

    return { service, user, accountStatusEventRepository };
  }
});
