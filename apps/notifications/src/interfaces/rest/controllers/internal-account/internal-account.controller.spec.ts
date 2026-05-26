import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { AccountPurgeService } from "@src/interfaces/rest/services/account-purge/account-purge.service";
import { InternalAccountController } from "./internal-account.controller";

describe("InternalAccountController", () => {
  it("logs ACCOUNT_PURGE_COMPLETED with the deletion counts on success", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const { controller, loggerService } = setup({ purgeReturns: { alertsDeleted: 3, channelsDeleted: 2 } });

    await controller.purge(userId);

    expect(loggerService.log).toHaveBeenCalledWith({
      event: "ACCOUNT_PURGE_COMPLETED",
      userId,
      alertsDeleted: 3,
      channelsDeleted: 2
    });
    expect(loggerService.error).not.toHaveBeenCalled();
  });

  it("logs ACCOUNT_PURGE_FAILED and rethrows when the service throws", async () => {
    const userId = "00000000-0000-0000-0000-000000000002";
    const error = new Error("db unavailable");
    const { controller, loggerService } = setup({ purgeRejects: error });

    await expect(controller.purge(userId)).rejects.toBe(error);

    expect(loggerService.error).toHaveBeenCalledWith({
      event: "ACCOUNT_PURGE_FAILED",
      userId,
      error
    });
    expect(loggerService.log).not.toHaveBeenCalled();
  });

  function setup(input: { purgeReturns?: { alertsDeleted: number; channelsDeleted: number }; purgeRejects?: unknown }) {
    const accountPurgeService = mock<AccountPurgeService>({
      purge: vi.fn(() =>
        input.purgeRejects ? Promise.reject(input.purgeRejects) : Promise.resolve(input.purgeReturns ?? { alertsDeleted: 0, channelsDeleted: 0 })
      )
    });
    const loggerService = mock<LoggerService>();
    const controller = new InternalAccountController(accountPurgeService, loggerService);
    return { controller, loggerService };
  }
});
