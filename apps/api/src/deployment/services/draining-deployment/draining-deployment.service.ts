import keyBy from "lodash/keyBy";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { LoggerService } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeployment, DrainingDeploymentLeaseSource } from "@src/deployment/types/draining-deployment";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentRpcService } from "../draining-deployment-rpc/draining-deployment-rpc.service";

export type { DrainingDeployment } from "@src/deployment/types/draining-deployment";

@singleton()
export class DrainingDeploymentService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly leaseRepository: LeaseRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly config: DeploymentConfigService,
    private readonly loggerService: LoggerService,
    private readonly rpcService: DrainingDeploymentRpcService
  ) {
    loggerService.setContext(DrainingDeploymentService.name);
  }

  async *findDrainingDeploymentsByOwner(): AsyncGenerator<{ address: string; deployments: DrainingDeployment[] }> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const expectedClosureHeight = Math.floor(currentHeight + averageBlockCountInAnHour * 2 * this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

    for await (const { address, deploymentSettings } of this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively()) {
      if (deploymentSettings.length === 0) {
        continue;
      }

      const dseqs = deploymentSettings.map(deployment => deployment.dseq);
      const drainingDeployments = await this.findLeases(expectedClosureHeight, address, dseqs);

      if (drainingDeployments.length) {
        const byDseqOwner = keyBy(drainingDeployments, "dseq");
        const [active, missingIds] = deploymentSettings.reduce<[DrainingDeployment[], string[]]>(
          (acc, deploymentSetting) => {
            const deployment = byDseqOwner[Number(deploymentSetting.dseq)];

            if (!deployment) {
              return acc;
            }

            if (deployment.closedHeight) {
              acc[1].push(deploymentSetting.id);
            } else {
              acc[0].push({
                ...deploymentSetting,
                predictedClosedHeight: deployment.predictedClosedHeight,
                blockRate: deployment.blockRate
              });
            }
            return acc;
          },
          [[], []]
        );

        if (missingIds.length) {
          await this.deploymentSettingRepository.updateManyById(missingIds, { closed: true });
        }

        if (active.length) {
          yield { address, deployments: active };
        }
      }
    }
  }

  async calculateTopUpAmountForDseqAndUserId(dseq: string, userId: string): Promise<number> {
    const userWallet = await this.userWalletRepository.findOneByUserId(userId);

    if (!userWallet) {
      return 0;
    }

    const deploymentSetting = await this.leaseRepository.findOneByDseqAndOwner(dseq, userWallet.address!);

    if (!deploymentSetting) {
      return 0;
    }

    return this.calculateTopUpAmount(deploymentSetting);
  }

  async calculateTopUpAmount(deployment: Pick<DrainingDeploymentOutput, "blockRate">): Promise<number> {
    return Math.floor(deployment.blockRate * (averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H")));
  }

  /**
   * Calculates the total cost for all deployments that would close before the target date.
   * This is based on each deployment's block rate and the number of blocks needed to keep them running until the target date.
   *
   * @param address - The address to calculate the deployment costs for
   * @param targetDate - The target date to calculate the costs until
   * @returns The total cost (in credits) needed to keep all draining deployments running until the target date
   */
  async calculateAllDeploymentCostUntilDate(address: string, targetDate: Date): Promise<number> {
    const userWallet = await this.userWalletRepository.findOneBy({ address });

    if (!userWallet || !userWallet.address) {
      return 0;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const now = new Date();
    const hoursUntilTarget = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const targetHeight = Math.floor(currentHeight + averageBlockCountInAnHour * hoursUntilTarget);

    let totalAmount = 0;

    const deploymentSettings = await this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);

    if (deploymentSettings.length === 0) {
      return totalAmount;
    }

    const dseqs = deploymentSettings.map(deployment => deployment.dseq);
    const drainingDeployments = await this.findLeases(targetHeight, address, dseqs);

    if (drainingDeployments.length === 0) {
      return totalAmount;
    }

    for (const { predictedClosedHeight, blockRate } of drainingDeployments) {
      if (predictedClosedHeight && predictedClosedHeight >= currentHeight && predictedClosedHeight <= targetHeight) {
        const blocksNeeded = targetHeight - currentHeight;
        const amountNeeded = Math.floor(blockRate * blocksNeeded);
        totalAmount += amountNeeded;
      }
    }

    return totalAmount;
  }

  async findLeases(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    if (!dseqs.length) {
      return [];
    }

    const leaseSource: DrainingDeploymentLeaseSource = this.rpcService;
    try {
      return await leaseSource.findManyByDseqAndOwner(closureHeight, owner, dseqs);
    } catch (error) {
      this.loggerService.error({
        event: "LEASE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
        message: `RPC query failed for owner ${owner}, falling back to database`,
        owner,
        error
      });
      return await this.leaseRepository.findManyByDseqAndOwner(closureHeight, owner, dseqs);
    }
  }
}
