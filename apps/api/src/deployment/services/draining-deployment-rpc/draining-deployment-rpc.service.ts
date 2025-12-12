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

  async findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]> {
    const dseqSet = new Set(dseqs);
    const [leases, deployments] = await Promise.all([this.#fetchLeases(owner, dseqSet), this.#fetchDeployments(owner, dseqSet)]);
    const leaseMap = this.#createDrainingDeploymentMap(leases);
    const deploymentMap = this.#createDeploymentMap(deployments);
    const outputs = this.#addPredictedClosedHeight(leaseMap, deploymentMap);
    return outputs.filter(output => output.predictedClosedHeight <= closureHeight);
  }

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

  #sumAmounts(items: Array<{ amount: string }>): number {
    return items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
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

  #createDeploymentMap(deployments: RpcDeploymentInfo[]): Map<string, RpcDeploymentInfo> {
    const deploymentMap = new Map<string, RpcDeploymentInfo>();

    for (const deployment of deployments) {
      const key = String(Number(deployment.dseq));
      deploymentMap.set(key, deployment);
    }

    return deploymentMap;
  }

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

      const predictedClosedHeight = Math.ceil(deployment.createdHeight + deployment.escrowBalance / drainingDeployment.blockRate);

      return [...acc, { ...drainingDeployment, predictedClosedHeight }];
    }, [] as DrainingDeploymentOutput[]);
  }
}
