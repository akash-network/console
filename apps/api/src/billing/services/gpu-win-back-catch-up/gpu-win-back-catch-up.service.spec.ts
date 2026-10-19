import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { GpuWinBackService } from "@src/billing/services/gpu-win-back/gpu-win-back.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentRepository, GpuDeploymentOwner } from "@src/deployment/repositories/deployment/deployment.repository";
import { GpuWinBackCatchUpService } from "./gpu-win-back-catch-up.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const NOW = new Date("2026-10-19T12:00:00.000Z");

describe(GpuWinBackCatchUpService.name, () => {
  describe("run", () => {
    it("reads the gpu deployments created in the last 30 days", async () => {
      const { service, deploymentRepository } = setup({ owners: [] });

      await service.run({ dryRun: false, now: NOW });

      expect(deploymentRepository.findGpuDeploymentOwnersSince).toHaveBeenCalledWith(subDays(NOW, 30));
    });

    it("checks a person a week after their latest gpu deployment when that week is not over", async () => {
      const latestGpuDeploymentCreatedAt = subDays(NOW, 3);
      const { service, gpuWinBackService, people } = setup({ owners: [{ latestGpuDeploymentCreatedAt }] });

      await expect(service.run({ dryRun: false, now: NOW })).resolves.toEqual({ scheduled: 1 });

      expect(gpuWinBackService.scheduleCheck).toHaveBeenCalledWith(people[0].userId, addDays(latestGpuDeploymentCreatedAt, 7));
    });

    it("checks a person right away when their latest gpu deployment is over a week old", async () => {
      const { service, gpuWinBackService, people } = setup({ owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 20) }] });

      await service.run({ dryRun: false, now: NOW });

      expect(gpuWinBackService.scheduleCheck).toHaveBeenCalledWith(people[0].userId, NOW);
    });

    it("checks every person who owns one of the deployments", async () => {
      const { service, gpuWinBackService, people } = setup({
        owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 10) }, { latestGpuDeploymentCreatedAt: subDays(NOW, 12) }]
      });

      await expect(service.run({ dryRun: false, now: NOW })).resolves.toEqual({ scheduled: 2 });

      expect(gpuWinBackService.scheduleCheck.mock.calls.map(([userId]) => userId)).toEqual(people.map(({ userId }) => userId));
    });

    it.each([
      { case: "a team wallet", wallet: "team" as const },
      { case: "no console wallet", wallet: "none" as const }
    ])("checks no one for a deployment owned by $case", async ({ wallet }) => {
      const { service, gpuWinBackService } = setup({ owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 10), wallet }] });

      await expect(service.run({ dryRun: false, now: NOW })).resolves.toEqual({ scheduled: 0 });

      expect(gpuWinBackService.scheduleCheck).not.toHaveBeenCalled();
    });

    it("looks the owners' wallets up across every organization, a thousand addresses at a time", async () => {
      const { service, userWalletRepository, wallets, owners } = setup({
        owners: Array.from({ length: 1001 }, () => ({ latestGpuDeploymentCreatedAt: subDays(NOW, 10), wallet: "none" as const }))
      });

      await service.run({ dryRun: false, now: NOW });

      expect(userWalletRepository.unscoped).toHaveBeenCalledWith("gpu-win-back-catch-up");
      expect(wallets.findByAddresses.mock.calls).toEqual([[owners.slice(0, 1000).map(({ owner }) => owner)], [[owners[1000].owner]]]);
    });

    it("counts only the checks it queued, leaving people whose check already waits to that check", async () => {
      const { service, gpuWinBackService } = setup({
        owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 10) }, { latestGpuDeploymentCreatedAt: subDays(NOW, 12) }]
      });
      gpuWinBackService.scheduleCheck.mockResolvedValueOnce(false);

      await expect(service.run({ dryRun: false, now: NOW })).resolves.toEqual({ scheduled: 1 });
    });

    it("counts the people it would check without queuing anything on a dry run", async () => {
      const { service, gpuWinBackService } = setup({
        owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 10) }, { latestGpuDeploymentCreatedAt: subDays(NOW, 12), wallet: "team" }]
      });

      await expect(service.run({ dryRun: true, now: NOW })).resolves.toEqual({ scheduled: 1 });

      expect(gpuWinBackService.scheduleCheck).not.toHaveBeenCalled();
    });

    it.each([{ dryRun: true }, { dryRun: false }])("logs how many people it scheduled when dryRun is $dryRun", async ({ dryRun }) => {
      const { service, logger } = setup({ owners: [{ latestGpuDeploymentCreatedAt: subDays(NOW, 10) }] });

      await service.run({ dryRun, now: NOW });

      expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WIN_BACK_CATCH_UP", scheduled: 1, dryRun });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ owners: [] });

    expect(createLogger).toHaveBeenCalledWith({ context: GpuWinBackCatchUpService.name });
  });

  function setup(input: { owners: { latestGpuDeploymentCreatedAt: Date; wallet?: "personal" | "team" | "none" }[] }) {
    const owners: GpuDeploymentOwner[] = input.owners.map(({ latestGpuDeploymentCreatedAt }) => ({
      owner: createAkashAddress(),
      latestGpuDeploymentCreatedAt
    }));
    const ownerWallets = owners.flatMap(({ owner }, index) => {
      const kind = input.owners[index].wallet ?? "personal";
      if (kind === "none") return [];

      const wallet = createUserWallet({ address: owner });

      return [kind === "personal" ? wallet : { ...wallet, userId: null }];
    });

    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findGpuDeploymentOwnersSince.mockResolvedValue(owners);

    const wallets = mock<UserWalletRepository>();
    wallets.findByAddresses.mockImplementation(async addresses => ownerWallets.filter(({ address }) => addresses.includes(address!)));
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.unscoped.mockReturnValue(wallets);

    const gpuWinBackService = mock<GpuWinBackService>();
    gpuWinBackService.scheduleCheck.mockResolvedValue(true);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new GpuWinBackCatchUpService(deploymentRepository, userWalletRepository, gpuWinBackService, createLogger);
    const people = ownerWallets.filter(({ userId }) => userId !== null).map(({ userId }) => ({ userId: userId! }));

    return { service, deploymentRepository, userWalletRepository, wallets, gpuWinBackService, logger, createLogger, owners, people };
  }
});
