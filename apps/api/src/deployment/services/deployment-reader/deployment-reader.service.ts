import { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { PromisePool } from "@supercharge/promise-pool";
import assert from "http-assert";
import { InternalServerError } from "http-errors";
import { singleton } from "tsyringe";

import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderList } from "@src/types/provider";

@singleton()
export class DeploymentReaderService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService
  ) {}

  public async findByOwnerAndDseq(
    owner: string,
    dseq: string,
    options?: { certificate?: { certPem: string; keyPem: string } }
  ): Promise<GetDeploymentResponse["data"]> {
    const deploymentResponse = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

    if ("code" in deploymentResponse) {
      assert(!deploymentResponse.message?.toLowerCase().includes("deployment not found"), 404, "Deployment not found");

      throw new InternalServerError(deploymentResponse.message);
    }

    const { leases } = await this.leaseHttpService.listByOwnerAndDseq(owner, dseq);

    const leasesWithStatus = await Promise.all(
      leases.map(async ({ lease }) => {
        if (!options?.certificate) {
          return {
            lease,
            status: null
          };
        }

        try {
          const leaseStatus = await this.providerService.getLeaseStatus(
            lease.lease_id.provider,
            lease.lease_id.dseq,
            lease.lease_id.gseq,
            lease.lease_id.oseq,
            options.certificate
          );
          return {
            lease,
            status: leaseStatus
          };
        } catch {
          return {
            lease,
            status: null
          };
        }
      })
    );

    return {
      deployment: deploymentResponse.deployment,
      leases: leasesWithStatus.map(({ lease, status }) => ({
        ...lease,
        status
      })),
      escrow_account: deploymentResponse.escrow_account
    };
  }

  public async listByOwner(
    owner: string,
    { skip, limit }: { skip?: number; limit?: number }
  ): Promise<{ deployments: GetDeploymentResponse["data"][]; total: number; hasMore: boolean }> {
    const pagination = skip !== undefined || limit !== undefined ? { offset: skip, limit } : undefined;
    const deploymentReponse = await this.deploymentHttpService.loadDeploymentList(owner, "active", pagination);
    const deployments = deploymentReponse.deployments;
    const total = parseInt(deploymentReponse.pagination.total, 10);

    const { results: leaseResults } = await PromisePool.withConcurrency(100)
      .for(deployments)
      .process(async deployment => this.leaseHttpService.listByOwnerAndDseq(owner, deployment.deployment.deployment_id.dseq));

    const deploymentsWithLeases = deployments.map((deployment, index) => ({
      deployment: deployment.deployment,
      leases:
        leaseResults[index]?.leases?.map(({ lease }) => ({
          ...lease,
          status: null as null
        })) ?? [],
      escrow_account: deployment.escrow_account
    }));

    return {
      deployments: deploymentsWithLeases,
      total,
      hasMore: skip !== undefined && limit !== undefined ? total > skip + limit : false
    };
  }

  public async listByOwnerAndStatus({
    address,
    status,
    skip,
    limit,
    reverseSorting
  }: {
    address: string;
    status?: "active" | "closed";
    skip?: number;
    limit?: number;
    reverseSorting?: boolean;
  }) {
    const response = await this.deploymentHttpService.loadDeploymentList(address, status, {
      offset: skip,
      limit: limit,
      reverse: reverseSorting,
      countTotal: true
    });
    const leaseResponse = await this.leaseHttpService.listByOwner(address);
    const providers = response.deployments.length ? await this.providerService.getProviderList() : ([] as ProviderList[]);

    return {
      count: parseInt(response.pagination.total),
      results: response.deployments.map(x => ({
        owner: x.deployment.deployment_id.owner,
        dseq: x.deployment.deployment_id.dseq,
        status: x.deployment.state,
        createdHeight: parseInt(x.deployment.created_at),
        escrowAccount: x.escrow_account,
        cpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        gpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        memoryQuantity: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        storageQuantity: x.groups
          .map(g =>
            g.group_spec.resources
              .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
              .reduce((a, b) => a + b, 0)
          )
          .reduce((a, b) => a + b, 0),
        leases: leaseResponse.leases
          .filter(l => l.lease.lease_id.dseq === x.deployment.deployment_id.dseq)
          .map(lease => {
            const provider = providers.find(p => p.owner === lease.lease.lease_id.provider);
            return {
              id: lease.lease.lease_id.dseq + lease.lease.lease_id.gseq + lease.lease.lease_id.oseq,
              owner: lease.lease.lease_id.owner,
              provider: provider,
              dseq: lease.lease.lease_id.dseq,
              gseq: lease.lease.lease_id.gseq,
              oseq: lease.lease.lease_id.oseq,
              state: lease.lease.state,
              price: lease.lease.price
            };
          })
      }))
    };
  }
}
