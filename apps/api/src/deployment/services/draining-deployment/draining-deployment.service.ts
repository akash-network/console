import keyBy from "lodash/keyBy";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";

type DrainingDeployment = AutoTopUpDeployment & {
  predictedClosedHeight: number;
  blockRate: number;
};
@singleton()
export class DrainingDeploymentService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly config: DeploymentConfigService
  ) {}

  async paginate(params: { limit: number }, cb: (page: DrainingDeployment[]) => Promise<void>) {
    await this.deploymentSettingRepository.paginateAutoTopUpDeployments({ limit: params.limit }, async deploymentSettings => {
      const currentHeight = await this.blockHttpService.getCurrentHeight();
      const expectedClosureHeight = Math.floor(currentHeight + averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

      const drainingDeployments = await this.leaseRepository.findManyByDseqAndOwner(
        expectedClosureHeight,
        deploymentSettings.map(deployment => ({ dseq: deployment.dseq, owner: deployment.address }))
      );

      if (drainingDeployments.length) {
        const byDseqOwner = keyBy(drainingDeployments, ({ dseq, owner }) => `${dseq}-${owner}`);

        await cb(
          deploymentSettings.map(deploymentSetting => {
            const deployment = byDseqOwner[`${deploymentSetting.dseq}-${deploymentSetting.address}`];
            return {
              ...deploymentSetting,
              predictedClosedHeight: deployment.predictedClosedHeight,
              blockRate: deployment.blockRate
            };
          })
        );
      }
    });
  }

  async calculateTopUpAmountForDseqAndUserId(dseq: string, userId: string): Promise<number> {
    const userWallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!userWallet) {
      return 0;
    }

    const deploymentSetting = await this.leaseRepository.findOneByDseqAndOwner(dseq, userWallet.address);

    if (!deploymentSetting) {
      return 0;
    }

    return this.calculateTopUpAmount(deploymentSetting);
  }

  async calculateTopUpAmount(deployment: Pick<DrainingDeploymentOutput, "blockRate">): Promise<number> {
    return Math.floor(deployment.blockRate * (averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H")));
  }
}
