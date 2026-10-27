import { singleton } from "tsyringe";

import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

export type DeploymentNameReader = { userId: string; organizationId?: string };

@singleton()
export class DeploymentNameService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository
  ) {}

  /** Null for a deployment Console holds no name for, and for one outside the reader's tenant, since any user can set an alert on any owner. */
  async findName({ owner, dseq, reader }: { owner: string; dseq: string; reader: DeploymentNameReader }): Promise<string | null> {
    const wallet = await this.userWalletRepository.findOneByAddress(owner);

    if (!wallet || !isInTenantOf(wallet, reader)) return null;

    const setting = await this.deploymentSettingRepository.findOneOwnedByWallet(wallet, dseq);

    return setting?.name ?? null;
  }
}

function isInTenantOf(wallet: UserWalletOutput, { userId, organizationId }: DeploymentNameReader): boolean {
  const isReadersOrganizationWallet = !!organizationId && wallet.organizationId === organizationId;
  const isReadersPersonalWallet = !!wallet.userId && wallet.userId === userId;

  return isReadersOrganizationWallet || isReadersPersonalWallet;
}
