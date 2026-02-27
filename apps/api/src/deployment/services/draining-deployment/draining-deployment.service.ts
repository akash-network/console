import { AnyAbility } from "@casl/ability";
import keyBy from "lodash/keyBy";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { LoggerService } from "@src/core";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeployment, LeaseQueryResult } from "@src/deployment/types/draining-deployment";
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
    private readonly rpcService: DrainingDeploymentRpcService,
    private readonly balancesService: BalancesService
  ) {
    loggerService.setContext(DrainingDeploymentService.name);
  }

  /**
   * Finds draining deployments grouped by owner address.
   * Iterates through all owners with auto-top-up enabled deployments,
   * fetches draining deployment data, and marks closed deployments.
   * Yields batches of active draining deployments per owner.
   *
   * @yields Object with owner address and array of draining deployments
   */
  async *findDrainingDeploymentsByOwner(): AsyncGenerator<{ address: string; deployments: DrainingDeployment[] }> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const expectedClosureHeight = Math.floor(currentHeight + averageBlockCountInAnHour * 2 * this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

    for await (const { address, deploymentSettings } of this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively()) {
      if (deploymentSettings.length === 0) {
        continue;
      }

      const dseqs = deploymentSettings.map(deployment => deployment.dseq);
      const { drainingDeployments, activeDseqs } = await this.findLeases(expectedClosureHeight, address, dseqs);

      const byDseq = keyBy(drainingDeployments, "dseq");
      const [active, closedIds] = deploymentSettings.reduce<[DrainingDeployment[], string[]]>(
        (acc, deploymentSetting) => {
          const deployment = byDseq[Number(deploymentSetting.dseq)];

          if (deployment) {
            acc[0].push({
              ...deploymentSetting,
              predictedClosedHeight: deployment.predictedClosedHeight,
              blockRate: deployment.blockRate
            });
          } else if (!activeDseqs.has(deploymentSetting.dseq)) {
            acc[1].push(deploymentSetting.id);
          }

          return acc;
        },
        [[], []]
      );

      if (closedIds.length) {
        await this.deploymentSettingRepository.updateManyById(closedIds, { closed: true });
      }

      if (active.length) {
        yield { address, deployments: active };
      }
    }
  }

  /**
   * Calculates the top-up amount needed for a specific deployment and user.
   * Looks up the user's wallet and deployment setting, then calculates
   * the required top-up amount based on the deployment's block rate.
   *
   * @param dseq - Deployment sequence number
   * @param userId - User ID to look up wallet for
   * @returns Top-up amount in credits, or 0 if user wallet or deployment not found
   */
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

  /**
   * Calculates the top-up amount needed for a deployment based on its block rate.
   * The calculation uses the configured auto-top-up interval to determine
   * how many blocks worth of funds are needed.
   *
   * @param deployment - Deployment with block rate information
   * @returns Top-up amount in credits
   */
  async calculateTopUpAmount(deployment: Pick<DrainingDeploymentOutput, "blockRate">): Promise<number> {
    return Math.floor(deployment.blockRate * (averageBlockCountInAnHour * this.config.get("AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H")));
  }

  /**
   * Calculates the total cost for all deployments that would close before the target date.
   * This is based on each deployment's block rate and the number of blocks needed to keep them running until the target date.
   *
   * @param address - The address to calculate the deployment costs for
   * @param targetDate - The target date to calculate the costs until and till which deployments would close
   * @returns The total cost (in credits) needed to keep all draining deployments running until the target date
   */
  async calculateAllDeploymentCostUntilDate(address: string, targetDate: Date): Promise<number> {
    const deploymentSettings = await this.#findAutoTopUpDeploymentSettings(address);

    if (deploymentSettings.length === 0) {
      return 0;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const now = new Date();

    const hoursUntilTarget = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const targetHeight = Math.floor(currentHeight + averageBlockCountInAnHour * hoursUntilTarget);
    const drainingDeployments = await this.#findDrainingDeployments(deploymentSettings, address, targetHeight);

    return await this.#accumulateDeploymentCost(drainingDeployments, ({ predictedClosedHeight, blockRate }) => {
      if (predictedClosedHeight && predictedClosedHeight >= currentHeight && predictedClosedHeight <= targetHeight) {
        const blocksNeeded = targetHeight - currentHeight;
        return Math.floor(blockRate * blocksNeeded);
      }
      return 0;
    });
  }

  /**
   * Calculates the weekly spending for all deployments with auto top-up enabled.
   * This calculates the cost to keep all deployments running for 7 days, regardless of when they would close.
   *
   * @param userId - The user ID to calculate the deployment costs for
   * @param ability - CASL ability instance for authorization checks
   * @returns The total weekly cost in USD for all deployments with auto top-up enabled
   */
  async calculateWeeklyDeploymentCost(userId: string, ability: AnyAbility): Promise<number> {
    const userWallet = await this.userWalletRepository.accessibleBy(ability, "read").findOneByUserId(userId);

    if (!userWallet?.address) {
      return 0;
    }

    const deploymentSettings = await this.deploymentSettingRepository.accessibleBy(ability, "read").findAutoTopUpDeploymentsByOwner(userWallet.address);

    if (deploymentSettings.length === 0) {
      return 0;
    }

    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const blocksInAWeek = Math.floor(averageBlockCountInAnHour * 24 * 7);
    const drainingDeployments = await this.#findDrainingDeployments(deploymentSettings, userWallet.address, Number.MAX_SAFE_INTEGER);

    const weeklyCost = await this.#accumulateDeploymentCost(drainingDeployments, ({ predictedClosedHeight, blockRate }) => {
      if (predictedClosedHeight && predictedClosedHeight > currentHeight && blockRate > 0) {
        return Math.floor(blockRate * blocksInAWeek);
      }
      return 0;
    });

    if (weeklyCost === 0) {
      return 0;
    }

    return await this.balancesService.toFiatAmount(weeklyCost);
  }

  /**
   * Finds auto top-up deployment settings for a given address.
   * Validates that the user wallet exists and has an address before querying.
   *
   * @param address - The wallet address to find deployment settings for
   * @returns Array of auto top-up deployment settings, or empty array if wallet not found
   */
  async #findAutoTopUpDeploymentSettings(address: string): Promise<AutoTopUpDeployment[]> {
    const userWallet = await this.userWalletRepository.findOneBy({ address });

    if (!userWallet?.address) {
      return [];
    }

    return this.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner(address);
  }

  /**
   * Finds draining deployments for the given deployment settings.
   * Extracts dseqs from settings and queries leases using the current height as closure height.
   *
   * @param deploymentSettings - Array of auto top-up deployment settings
   * @param address - The owner address to query deployments for
   * @param closureHeight - Current block height to use as closure height threshold
   * @returns Array of draining deployment outputs
   */
  async #findDrainingDeployments(deploymentSettings: AutoTopUpDeployment[], address: string, closureHeight: number): Promise<DrainingDeploymentOutput[]> {
    const dseqs = deploymentSettings.map(deployment => deployment.dseq);
    const { drainingDeployments } = await this.findLeases(closureHeight, address, dseqs);
    return drainingDeployments;
  }

  /**
   * Accumulates deployment costs by applying a callback function to each deployment.
   * Sums up the cost values returned by the callback for all deployments.
   *
   * @param drainingDeployments - Array of draining deployment outputs to process
   * @param callback - Async function that calculates cost for a single deployment
   * @returns Total accumulated cost across all deployments
   */
  async #accumulateDeploymentCost(
    drainingDeployments: DrainingDeploymentOutput[],
    callback: (deployment: DrainingDeploymentOutput) => number
  ): Promise<number> {
    let totalAmount = 0;
    for (const deployment of drainingDeployments) {
      totalAmount += callback(deployment);
    }
    return totalAmount;
  }

  /**
   * Finds leases for draining deployments, falling back to database if RPC fails.
   * Attempts to fetch from RPC service first, then falls back to database
   * repository if the RPC call fails.
   *
   * @param closureHeight - The block height threshold for filtering draining deployments
   * @param owner - The owner address to query deployments for
   * @param dseqs - Array of deployment sequence numbers to filter by
   * @returns Array of draining deployment outputs
   */
  async findLeases(closureHeight: number, owner: string, dseqs: string[]): Promise<LeaseQueryResult> {
    if (!dseqs.length) {
      return { drainingDeployments: [], activeDseqs: new Set() };
    }

    try {
      return await this.rpcService.findManyByDseqAndOwner(closureHeight, owner, dseqs);
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
