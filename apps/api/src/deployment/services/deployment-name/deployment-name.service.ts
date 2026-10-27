import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";

@singleton()
export class DeploymentNameService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository
  ) {}

  /** Null for a deployment Console holds no name for, which includes every deployment of a wallet Console does not manage. */
  async findName({ owner, dseq }: { owner: string; dseq: string }): Promise<string | null> {
    const wallet = await this.userWalletRepository.findOneByAddress(owner);

    if (!wallet) return null;

    const setting = await this.deploymentSettingRepository.findOneOwnedByWallet(wallet, dseq);

    return setting?.name ?? null;
  }
}
