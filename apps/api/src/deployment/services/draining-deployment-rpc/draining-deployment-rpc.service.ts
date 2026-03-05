import { DeploymentHttpService, LeaseHttpService, type RpcLease } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentLeaseSource, RpcDeploymentInfo } from "@src/deployment/types/draining-deployment";

@singleton()
export class DrainingDeploymentRpcService implements DrainingDeploymentLeaseSource {
  constructor(
    private readonly leaseHttpService: LeaseHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(DrainingDeploymentRpcService.name);
  }

  /**
   * Finds draining deployments by owner and dseqs from RPC.
   * Fetches lease and deployment data, calculates block rates, and predicts closure heights.
   * Returns only deployments that are predicted to close before or at the closure height.
   *
   * @param closureHeight - The block height threshold for filtering draining deployments
   * @param owner - The owner address to query deployments for
   * @param dseqs - Array of deployment sequence numbers to filter by
   * @returns Array of draining deployment outputs with predicted closure heights
   */
  async findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    if (!dseqs.length) {
      return [];
    }

    const dseqSet = new Set(dseqs);
    const [leases, deployments] = await Promise.all([this.#fetchLeases(owner, dseqSet), this.#fetchDeployments(owner, dseqSet)]);
    const leaseMap = this.#createDrainingDeploymentMap(leases);
    const deploymentMap = this.#createDeploymentMap(deployments);
    const outputs = this.#addPredictedClosedHeight(leaseMap, deploymentMap);

    this.loggerService.debug({ event: "RPC_RESOURCES_FETCHED", dseqSet, leases, deployments, result: outputs });

    return outputs.filter(output => output.predictedClosedHeight <= closureHeight);
  }

  /**
   * Fetches lease data from RPC for the given owner and dseqs.
   * Handles pagination automatically.
   *
   * @param owner - The owner address to query leases for
   * @param dseqSet - Set of deployment sequence numbers to filter by
   * @returns Array of RPC lease data
   */
  async #fetchLeases(owner: string, dseqSet: Set<string>): Promise<RpcLease[]> {
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

  /**
   * Fetches deployment data from RPC for the given owner and dseqs.
   * Handles pagination automatically and calculates escrow balances.
   *
   * @param owner - The owner address to query deployments for
   * @param dseqSet - Set of deployment sequence numbers to filter by
   * @returns Array of RPC deployment info with escrow balances
   */
  async #fetchDeployments(owner: string, dseqSet: Set<string>): Promise<RpcDeploymentInfo[]> {
    const allItems: RpcDeploymentInfo[] = [];
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
          createdHeight: Number(deployment.deployment.created_at),
          escrowBalance: this.#sumAmounts(deployment.escrow_account.state.funds) + this.#sumAmounts(deployment.escrow_account.state.transferred)
        }));

      allItems.push(...filteredItems);
      nextKey = response.pagination.next_key;
    } while (nextKey);

    return allItems;
  }

  /**
   * Sums amount strings by parsing them as numbers.
   * Amounts are typically integers formatted as decimals (e.g., "500000.000000000000000000").
   * Logs warnings for invalid amounts but continues processing.
   *
   * @param items - Array of objects with amount strings (may contain decimal points)
   * @returns Sum of amounts as a number
   */
  #sumAmounts(items: Array<{ amount: string }>): number {
    return items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  }

  /**
   * Creates a map of draining deployments from RPC lease data.
   * Aggregates block rates by summing rate amounts for each dseq.
   * This implementation assumes that denom is always the same for managed wallets
   * for which these methods are used, allowing direct summation of rate amounts.
   *
   * @param rpcLeases - Array of RPC lease data
   * @returns Map of dseq to draining deployment output (without predictedClosedHeight)
   */
  #createDrainingDeploymentMap(rpcLeases: RpcLease[]): Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">> {
    const leaseMap = new Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">>();

    for (const rpcLease of rpcLeases) {
      const dseq = rpcLease.lease.id.dseq;
      const owner = rpcLease.lease.id.owner;

      const denom = rpcLease.escrow_payment.state.rate.denom;
      const rateAmount = Number(rpcLease.escrow_payment.state.rate.amount);
      const closedHeight = rpcLease.lease.closed_on && rpcLease.lease.closed_on !== "0" ? Number(rpcLease.lease.closed_on) : undefined;

      const existing = leaseMap.get(dseq);
      if (existing) {
        existing.blockRate += rateAmount;
        if (!closedHeight) {
          existing.closedHeight = undefined;
        }
      } else {
        leaseMap.set(dseq, {
          dseq: Number(dseq),
          owner,
          denom,
          blockRate: rateAmount,
          closedHeight
        });
      }
    }

    return leaseMap;
  }

  /**
   * Creates a map of deployments keyed by normalized dseq string.
   * Normalizes dseq keys to handle leading zeros consistently.
   *
   * @param deployments - Array of RPC deployment info
   * @returns Map of normalized dseq to deployment info
   */
  #createDeploymentMap(deployments: RpcDeploymentInfo[]): Map<string, RpcDeploymentInfo> {
    const deploymentMap = new Map<string, RpcDeploymentInfo>();

    for (const deployment of deployments) {
      const key = String(Number(deployment.dseq));
      deploymentMap.set(key, deployment);
    }

    return deploymentMap;
  }

  /**
   * Adds predicted closure heights to draining deployments.
   * Calculates closure height based on escrow balance and block rate.
   * Filters out deployments with missing data, zero balance,
   * or invalid block rates, logging warnings for each case.
   *
   * @param leaseMap - Map of draining deployments without predictedClosedHeight
   * @param deploymentMap - Map of deployment info with escrow balances
   * @returns Array of draining deployment outputs with predicted closure heights
   */
  #addPredictedClosedHeight(
    leaseMap: Map<string, Omit<DrainingDeploymentOutput, "predictedClosedHeight">>,
    deploymentMap: Map<string, RpcDeploymentInfo>
  ): DrainingDeploymentOutput[] {
    return Array.from(leaseMap.values()).reduce((acc, drainingDeployment) => {
      const deployment = deploymentMap.get(drainingDeployment.dseq.toString());

      if (!deployment) {
        this.loggerService.warn({
          event: "DEPLOYMENT_NOT_FOUND",
          dseq: drainingDeployment.dseq,
          owner: drainingDeployment.owner
        });
        return acc;
      }

      if (deployment.escrowBalance <= 0) {
        this.loggerService.warn({
          event: "DEPLOYMENT_HAS_NO_BALANCE",
          dseq: drainingDeployment.dseq,
          owner: drainingDeployment.owner
        });
        return acc;
      }

      if (drainingDeployment.blockRate <= 0) {
        this.loggerService.warn({
          event: "DEPLOYMENT_BLOCK_RATE_INVALID",
          dseq: drainingDeployment.dseq,
          owner: drainingDeployment.owner
        });
        return acc;
      }

      // Calculate blocks: ceil(escrow / rate)
      const blocks = Math.ceil(deployment.escrowBalance / drainingDeployment.blockRate);
      const predictedClosedHeight = deployment.createdHeight + blocks;

      return [...acc, { ...drainingDeployment, predictedClosedHeight }];
    }, [] as DrainingDeploymentOutput[]);
  }
}
