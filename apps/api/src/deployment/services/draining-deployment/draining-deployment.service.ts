import { DeploymentHttpService, LeaseHttpService, type RpcLease } from "@akashnetwork/http-sdk";
import keyBy from "lodash/keyBy";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { LoggerService } from "@src/core";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";

export type DrainingDeployment = AutoTopUpDeployment & {
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
    private readonly config: DeploymentConfigService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly loggerService: LoggerService,
    private readonly deploymentHttpService: DeploymentHttpService
  ) {
    loggerService.setContext(DrainingDeploymentService.name);
  }

  async *findDrainingDeploymentsByOwner(): AsyncGenerator<{ address: string; deployments: DrainingDeployment[] }> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const expectedClosureHeight = Math.floor(currentHeight + averageBlockCountInAnHour * 2 * this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

    for await (const { address, deploymentSettings } of this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner()) {
      if (deploymentSettings.length === 0) {
        continue;
      }

      const dseqs = deploymentSettings.map(deployment => deployment.dseq);
      const drainingDeployments = await this.#findLeases(expectedClosureHeight, address, dseqs);

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

        yield { address, deployments: active };
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

    for await (const deploymentSettings of this.deploymentSettingRepository.paginateAutoTopUpDeployments({ address, limit: 100 })) {
      if (deploymentSettings.length === 0) {
        continue;
      }

      const owner = deploymentSettings[0].address;
      const dseqs = deploymentSettings.map(deployment => deployment.dseq);

      const drainingDeployments = await this.leaseRepository.findManyByDseqAndOwner(targetHeight, owner, dseqs);

      if (drainingDeployments.length === 0) {
        continue;
      }

      for (const { predictedClosedHeight, blockRate } of drainingDeployments) {
        if (predictedClosedHeight && predictedClosedHeight >= currentHeight && predictedClosedHeight <= targetHeight) {
          const blocksNeeded = targetHeight - currentHeight;
          const amountNeeded = Math.floor(blockRate * blocksNeeded);
          totalAmount += amountNeeded;
        }
      }
    }

    return totalAmount;
  }

  async #findLeases(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    if (!dseqs.length) {
      return [];
    }

    try {
      return await this.#queryLeasesFromRpc(closureHeight, owner, dseqs);
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

  async #queryLeasesFromRpc(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    const dseqSet = new Set(dseqs);
    const [leases, deployments] = await Promise.all([this.#fetchAndFilterLeases(owner, dseqSet), this.#fetchAndFilterDeployments(owner, dseqSet)]);
    const leaseMap = this.#createDrainingDeploymentMap(leases);
    const deploymentBalanceMap = this.#createDeploymentBalanceMap(deployments);
    const outputs = await this.#addPredictedClosedHeight(leaseMap, deploymentBalanceMap);

    return outputs.filter(output => output.predictedClosedHeight <= closureHeight);
  }

  async #fetchAndFilterLeases(owner: string, dseqSet: Set<string>): Promise<RpcLease[]> {
    const allItems: RpcLease[] = [];
    let nextKey: string | null = null;

    do {
      const response = await this.leaseHttpService.list({
        owner,
        pagination: { limit: 1000, key: nextKey || undefined }
      });

      const filteredItems = response.leases.filter(lease => dseqSet.has(lease.lease.id.dseq));
      allItems.push(...filteredItems);
      nextKey = response.pagination.next_key;
    } while (nextKey);

    return allItems;
  }

  async #fetchAndFilterDeployments(owner: string, dseqSet: Set<string>): Promise<{ dseq: string; escrowBalance: number }[]> {
    const allItems: { dseq: string; escrowBalance: number }[] = [];
    let nextKey: string | null = null;

    do {
      const response = await this.deploymentHttpService.findAll({
        owner,
        pagination: { limit: 1000, key: nextKey || undefined }
      });

      const filteredItems = response.deployments
        .filter(deployment => dseqSet.has(deployment.deployment.id.dseq))
        .map(deployment => ({
          dseq: deployment.deployment.id.dseq,
          escrowBalance: deployment.escrow_account.state.funds.reduce((sum, fund) => sum + parseFloat(fund.amount), 0)
        }));

      allItems.push(...filteredItems);
      nextKey = response.pagination.next_key;
    } while (nextKey);

    return allItems;
  }

  #createDrainingDeploymentMap(rpcLeases: RpcLease[]): Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">> {
    const leaseMap = new Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">>();

    for (const rpcLease of rpcLeases) {
      const dseq = rpcLease.lease.id.dseq;
      const owner = rpcLease.lease.id.owner;

      const denom = rpcLease.escrow_payment.state.rate.denom;
      const rateAmount = Number(rpcLease.escrow_payment.state.rate.amount);

      const existing = leaseMap.get(dseq);
      if (existing) {
        existing.blockRate += rateAmount;
      } else {
        leaseMap.set(dseq, {
          dseq: Number(dseq),
          owner,
          denom,
          blockRate: rateAmount,
          closedHeight: rpcLease.lease.closed_on && rpcLease.lease.closed_on !== "0" ? Number(rpcLease.lease.closed_on) : undefined
        });
      }
    }

    return leaseMap;
  }

  #createDeploymentBalanceMap(deployments: { dseq: string; escrowBalance: number }[]): Map<string, number> {
    const deploymentBalanceMap = new Map<string, number>();

    for (const deployment of deployments) {
      const key = deployment.dseq;
      deploymentBalanceMap.set(key, deployment.escrowBalance);
    }

    return deploymentBalanceMap;
  }

  async #addPredictedClosedHeight(
    leaseMap: Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">>,
    deploymentBalanceMap: Map<string, number>
  ): Promise<DrainingDeploymentOutput[]> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    return Array.from(leaseMap.values()).map(drainingDeployment => {
      const deploymentBalance = deploymentBalanceMap.get(drainingDeployment.dseq.toString()) ?? 0;

      const predictedClosedHeight =
        drainingDeployment.blockRate > 0 && deploymentBalance > 0 ? Math.ceil(currentHeight + deploymentBalance / drainingDeployment.blockRate) : currentHeight;

      return { ...drainingDeployment, predictedClosedHeight };
    });
  }
}
