import { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderList } from "@src/types/provider";

@singleton()
export class DeploymentListByOwnerService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService
  ) {}

  public async listByOwner(owner: string, skip: number, limit: number, reverseSorting: boolean, filters: { status?: string } = {}) {
    const response = await this.deploymentHttpService.loadDeploymentList(owner, filters.status, {
      offset: skip,
      limit: limit,
      reverse: reverseSorting,
      countTotal: true
    });
    const leaseResponse = await this.leaseHttpService.listByOwner(owner);
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
