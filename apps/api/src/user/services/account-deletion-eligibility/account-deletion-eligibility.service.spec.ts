import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import { AccountDeletionEligibilityService } from "./account-deletion-eligibility.service";

import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AccountDeletionEligibilityService.name, () => {
  it("names the dseqs of the active deployments the wallet owns", async () => {
    const wallet = createUserWallet({ isTrialing: true });
    const { service, deploymentHttpService } = setup({ wallet, activeDseqs: ["101", "202"] });

    const eligibility = await service.assess(wallet.userId);

    expect(eligibility.activeDeploymentDseqs).toEqual(["101", "202"]);
    expect(deploymentHttpService.findAll).toHaveBeenCalledWith({ owner: wallet.address, state: "active" });
  });

  it("reports the remaining credits of a paying user as forfeitable", async () => {
    const wallet = createUserWallet({ isTrialing: false });
    const { service, balancesService } = setup({ wallet, balanceUsd: 12.5 });

    const eligibility = await service.assess(wallet.userId);

    expect(eligibility).toEqual({ activeDeploymentDseqs: [], isTrialing: false, forfeitableBalanceUsd: 12.5 });
    expect(balancesService.getDeploymentBalanceInFiat).toHaveBeenCalledWith(wallet.address);
  });

  it("does not count trial credits as forfeitable", async () => {
    const wallet = createUserWallet({ isTrialing: true });
    const { service, balancesService } = setup({ wallet, balanceUsd: 100 });

    const eligibility = await service.assess(wallet.userId);

    expect(eligibility).toEqual({ activeDeploymentDseqs: [], isTrialing: true, forfeitableBalanceUsd: 0 });
    expect(balancesService.getDeploymentBalanceInFiat).not.toHaveBeenCalled();
  });

  it("treats a wallet that never got an address as having nothing to block on", async () => {
    const wallet = createUserWallet({ isTrialing: false, address: null });
    const { service, deploymentHttpService, balancesService } = setup({ wallet });

    const eligibility = await service.assess(wallet.userId);

    expect(eligibility).toEqual({ activeDeploymentDseqs: [], isTrialing: false, forfeitableBalanceUsd: 0 });
    expect(deploymentHttpService.findAll).not.toHaveBeenCalled();
    expect(balancesService.getDeploymentBalanceInFiat).not.toHaveBeenCalled();
  });

  it("treats a user without a wallet as a trial user with nothing to block on", async () => {
    const { service } = setup({ wallet: undefined });

    const eligibility = await service.assess("user-without-wallet");

    expect(eligibility).toEqual({ activeDeploymentDseqs: [], isTrialing: true, forfeitableBalanceUsd: 0 });
  });

  function setup(input: { wallet: UserWalletOutput | undefined; activeDseqs?: string[]; balanceUsd?: number }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(input.wallet);

    const deploymentHttpService = mock<DeploymentHttpService>();
    const deployments = (input.activeDseqs ?? []).map(dseq => createDeploymentInfoSeed({ dseq, owner: input.wallet?.address ?? undefined, state: "active" }));
    deploymentHttpService.findAll.mockResolvedValue({ deployments, pagination: { next_key: null, total: String(deployments.length) } });

    const balancesService = mock<BalancesService>();
    balancesService.getDeploymentBalanceInFiat.mockResolvedValue(input.balanceUsd ?? 0);

    const service = new AccountDeletionEligibilityService(userWalletRepository, deploymentHttpService, balancesService);

    return { service, userWalletRepository, deploymentHttpService, balancesService };
  }
});
