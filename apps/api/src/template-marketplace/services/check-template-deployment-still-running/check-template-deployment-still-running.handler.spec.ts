import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import { CheckTemplateDeploymentStillRunningHandler } from "./check-template-deployment-still-running.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(CheckTemplateDeploymentStillRunningHandler.name, () => {
  it("records a deployment still holding an active lease", async () => {
    const { handler, wallet, payload, userWalletRepository, leaseRepository, templateUsageService } = setup({
      activeLeaseCount: 1,
      trialAtLease: true,
      trialNow: false
    });

    await handler.handle(payload);

    expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ id: payload.walletId });
    expect(leaseRepository.findActiveLeasesOfDeployment).toHaveBeenCalledWith(wallet.address, payload.dseq);
    expect(templateUsageService.recordStillRunning).toHaveBeenCalledTimes(1);
    expect(templateUsageService.recordStillRunning).toHaveBeenCalledWith({
      deploymentSettingId: payload.deploymentSettingId,
      dseq: payload.dseq,
      isTrial: true
    });
  });

  it("records the trial state of the lease rather than of the wallet now", async () => {
    const { handler, payload, templateUsageService } = setup({ activeLeaseCount: 1, trialAtLease: false, trialNow: true });

    await handler.handle(payload);

    expect(templateUsageService.recordStillRunning).toHaveBeenCalledWith(expect.objectContaining({ isTrial: false }));
  });

  it("records nothing for a deployment whose leases closed", async () => {
    const { handler, payload, templateUsageService } = setup({ activeLeaseCount: 0 });

    await expect(handler.handle(payload)).resolves.toBeUndefined();

    expect(templateUsageService.recordStillRunning).not.toHaveBeenCalled();
  });

  it("throws on a failed chain read so the job retries", async () => {
    const { handler, payload, leaseRepository, templateUsageService } = setup({ activeLeaseCount: 1 });
    const failure = new Error("chain database unavailable");
    leaseRepository.findActiveLeasesOfDeployment.mockRejectedValue(failure);

    await expect(handler.handle(payload)).rejects.toBe(failure);

    expect(templateUsageService.recordStillRunning).not.toHaveBeenCalled();
  });

  it("rejects when the still-running insert fails so the job retries", async () => {
    const { handler, payload, templateUsageService } = setup({ activeLeaseCount: 1 });
    const failure = new Error("usage insert failed");
    templateUsageService.recordStillRunning.mockRejectedValue(failure);

    await expect(handler.handle(payload)).rejects.toBe(failure);
  });

  it("records nothing for a wallet that is gone", async () => {
    const { handler, payload, leaseRepository, templateUsageService } = setup({ activeLeaseCount: 1, walletFound: false });

    await expect(handler.handle(payload)).resolves.toBeUndefined();

    expect(leaseRepository.findActiveLeasesOfDeployment).not.toHaveBeenCalled();
    expect(templateUsageService.recordStillRunning).not.toHaveBeenCalled();
  });

  it("records nothing for a wallet that never got an address", async () => {
    const { handler, payload, leaseRepository, templateUsageService } = setup({ activeLeaseCount: 1, address: null });

    await expect(handler.handle(payload)).resolves.toBeUndefined();

    expect(leaseRepository.findActiveLeasesOfDeployment).not.toHaveBeenCalled();
    expect(templateUsageService.recordStillRunning).not.toHaveBeenCalled();
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(setup({ activeLeaseCount: 0 }).handler.requiresPermission()).toEqual([]);
  });

  it("declares the exclusive policy with two workers", () => {
    const { handler } = setup({ activeLeaseCount: 0 });

    expect({ policy: handler.policy, concurrency: handler.concurrency }).toEqual({ policy: "exclusive", concurrency: 2 });
  });

  function setup(input: { activeLeaseCount: number; walletFound?: boolean; address?: string | null; trialAtLease?: boolean; trialNow?: boolean }) {
    const wallet = createUserWallet({ address: input.address === undefined ? createAkashAddress() : input.address, isTrialing: input.trialNow ?? false });
    const payload = {
      deploymentSettingId: faker.string.uuid(),
      walletId: wallet.id,
      dseq: faker.string.numeric(8),
      isTrial: input.trialAtLease ?? false,
      version: 1 as const
    };
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneBy.mockResolvedValue(input.walletFound === false ? undefined : wallet);
    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findActiveLeasesOfDeployment.mockResolvedValue(
      Array.from({ length: input.activeLeaseCount }, () => ({ owner: wallet.address as string, dseq: payload.dseq, providerAddress: createAkashAddress() }))
    );
    const templateUsageService = mock<TemplateUsageService>();
    const handler = new CheckTemplateDeploymentStillRunningHandler(userWalletRepository, leaseRepository, templateUsageService);

    return { handler, wallet, payload, userWalletRepository, leaseRepository, templateUsageService };
  }
});
