import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import { AccountStatusGuard } from "./account-status-guard.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountStatusGuard.name, () => {
  describe("assertMaySpend", () => {
    it("lets an active user through without reading the reason", async () => {
      const { guard, accountStatusService } = setup();

      await expect(guard.assertMaySpend(createUser({ accountStatus: "active" }))).resolves.toBeUndefined();
      expect(accountStatusService.findUserReasonOf).not.toHaveBeenCalled();
    });

    it("refuses a suspended user with account_suspended and the reason written for them", async () => {
      const { guard, accountStatusService } = setup({ reason: "Unpaid invoices" });
      const user = createUser({ accountStatus: "suspended" });

      await expect(guard.assertMaySpend(user)).rejects.toMatchObject({
        status: 403,
        errorCode: "account_suspended",
        data: { reason: "Unpaid invoices" }
      });
      expect(accountStatusService.findUserReasonOf).toHaveBeenCalledWith(user);
    });

    it("refuses a terminated user with account_terminated", async () => {
      const { guard } = setup({ reason: "Fraud" });

      await expect(guard.assertMaySpend(createUser({ accountStatus: "terminated" }))).rejects.toMatchObject({
        status: 403,
        errorCode: "account_terminated",
        data: { reason: "Fraud" }
      });
    });
  });

  describe("assertNotTerminated", () => {
    it.each(["active", "suspended"] as const)("lets a %s user through without reading the reason", async accountStatus => {
      const { guard, accountStatusService } = setup();

      await expect(guard.assertNotTerminated(createUser({ accountStatus }))).resolves.toBeUndefined();
      expect(accountStatusService.findUserReasonOf).not.toHaveBeenCalled();
    });

    it("refuses a terminated user with account_terminated and the reason written for them", async () => {
      const { guard, accountStatusService } = setup({ reason: "Fraud" });
      const user = createUser({ accountStatus: "terminated" });

      await expect(guard.assertNotTerminated(user)).rejects.toMatchObject({
        status: 403,
        errorCode: "account_terminated",
        message: "Your account has been terminated",
        data: { reason: "Fraud" }
      });
      expect(accountStatusService.findUserReasonOf).toHaveBeenCalledWith(user);
    });
  });

  describe("assertUserMaySpend", () => {
    it("refuses a suspended user found by id", async () => {
      const { guard, userRepository } = setup({ accountStatus: "suspended", reason: "Chargeback" });

      await expect(guard.assertUserMaySpend("user-1")).rejects.toMatchObject({ status: 403, errorCode: "account_suspended", data: { reason: "Chargeback" } });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: "user-1" });
    });

    it("lets an active user found by id through", async () => {
      const { guard } = setup({ accountStatus: "active" });

      await expect(guard.assertUserMaySpend("user-1")).resolves.toBeUndefined();
    });

    it("lets an unknown user through", async () => {
      const { guard } = setup({ accountStatus: undefined });

      await expect(guard.assertUserMaySpend("user-1")).resolves.toBeUndefined();
    });
  });

  describe("maySpend", () => {
    it.each([
      { accountStatus: "active", expected: true },
      { accountStatus: "suspended", expected: false },
      { accountStatus: "terminated", expected: false },
      { accountStatus: undefined, expected: true }
    ] as const)("answers $expected for a user whose account is $accountStatus", async ({ accountStatus, expected }) => {
      const { guard, userRepository } = setup({ accountStatus });

      expect(await guard.maySpend("user-1")).toBe(expected);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: "user-1" });
    });
  });

  function setup(input: { accountStatus?: AccountStatus; reason?: string } = {}) {
    const user = input.accountStatus ? createUser({ id: "user-1", accountStatus: input.accountStatus }) : undefined;
    const userRepository = mock<UserRepository>({ findOneBy: vi.fn().mockResolvedValue(user) });
    const accountStatusService = mock<AccountStatusService>({ findUserReasonOf: vi.fn().mockResolvedValue(input.reason ?? null) });
    const guard = new AccountStatusGuard(userRepository, accountStatusService);

    return { guard, userRepository, accountStatusService };
  }
});
