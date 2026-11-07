import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletSettingRepository } from "@src/billing/repositories";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { AutoReloadShutoffService } from "./auto-reload-shutoff.service";

describe(AutoReloadShutoffService.name, () => {
  it("turns auto reload off for the wallet past the organization scope it was given a reason for, then cancels its queued checks", async () => {
    const { service, walletSettingRepository, walletReloadJobService, calls } = setup();
    const wallet = { id: faker.number.int({ min: 1, max: 1_000_000 }), userId: null };

    await service.turnOff(wallet, "organization-deletion");

    expect(walletSettingRepository.unscoped).toHaveBeenCalledWith("organization-deletion");
    expect(walletSettingRepository.updateBy).toHaveBeenCalledWith({ walletId: wallet.id }, { autoReloadEnabled: false });
    expect(walletReloadJobService.cancelReloadCheck).toHaveBeenCalledWith({ walletId: wallet.id });
    expect(walletReloadJobService.cancelCreditsLowCheck).toHaveBeenCalledWith({ walletId: wallet.id });
    expect(calls).toEqual(["turnOff", "cancelReloadCheck", "cancelCreditsLowCheck"]);
  });

  it("cancels the checks of a personal wallet by its user, which is how they are queued", async () => {
    const { service, walletSettingRepository, walletReloadJobService } = setup();
    const wallet = { id: faker.number.int({ min: 1, max: 1_000_000 }), userId: faker.string.uuid() };

    await service.turnOff(wallet, "account-termination");

    expect(walletSettingRepository.updateBy).toHaveBeenCalledWith({ walletId: wallet.id }, { autoReloadEnabled: false });
    expect(walletReloadJobService.cancelReloadCheck).toHaveBeenCalledWith({ userId: wallet.userId });
    expect(walletReloadJobService.cancelCreditsLowCheck).toHaveBeenCalledWith({ userId: wallet.userId });
  });

  function setup() {
    const calls: string[] = [];
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.unscoped.mockReturnValue(walletSettingRepository);
    walletSettingRepository.updateBy.mockImplementation(async () => {
      calls.push("turnOff");
    });
    const walletReloadJobService = mock<WalletReloadJobService>();
    walletReloadJobService.cancelReloadCheck.mockImplementation(async () => {
      calls.push("cancelReloadCheck");
    });
    walletReloadJobService.cancelCreditsLowCheck.mockImplementation(async () => {
      calls.push("cancelCreditsLowCheck");
    });
    const service = new AutoReloadShutoffService(walletSettingRepository, walletReloadJobService);

    return { service, walletSettingRepository, walletReloadJobService, calls };
  }
});
