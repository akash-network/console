import { DeploymentDto, LeaseDto, RpcDeployment, RpcLease } from "@src/types/deployment";
import { coinToUDenom } from "./priceUtils";

export function deploymentResourceSum(deployment: RpcDeployment, resourceSelector) {
  return deployment.groups
    .map(g => g.group_spec.resources.map(r => r.count * resourceSelector(r.resources ?? r.resource)).reduce((a, b) => a + b))
    .reduce((a, b) => a + b);
}

export function deploymentGroupResourceSum(group, resourceSelector) {
  if (!group || !group.group_spec || !group.group_spec) return 0;

  return group.group_spec.resources.map(r => r.count * resourceSelector(r.resources ?? r.resource)).reduce((a, b) => a + b);
}

export function deploymentToDto(d: RpcDeployment): DeploymentDto {
  let escrowBalanceUAkt = coinToUDenom(d.escrow_account.balance);
  if (d.escrow_account.funds) {
    escrowBalanceUAkt += coinToUDenom(d.escrow_account.funds);
  }

  return {
    dseq: d.deployment.deployment_id.dseq,
    state: d.deployment.state,
    version: d.deployment.version,
    denom: d.escrow_account.balance.denom,
    createdAt: parseInt(d.deployment.created_at),
    escrowBalance: escrowBalanceUAkt,
    transferred: d.escrow_account.transferred,
    cpuAmount: deploymentResourceSum(d, r => parseInt(r.cpu.units.val) / 1000),
    gpuAmount: deploymentResourceSum(d, r => parseInt(r.gpu?.units?.val || 0)),
    memoryAmount: deploymentResourceSum(d, r => parseInt(r.memory.quantity.val)),
    storageAmount: deploymentResourceSum(d, r =>
      convertToArrayIfNeeded(r.storage)
        .map(x => parseInt(x.quantity.val))
        .reduce((a, b) => a + b, 0)
    ),
    escrowAccount: { ...d.escrow_account },
    groups: [...d.groups]
  };
}

export function convertToArrayIfNeeded<T>(arrayOrItem: T | T[]) {
  return Array.isArray(arrayOrItem) ? arrayOrItem : [arrayOrItem];
}

export const getStorageAmount = resource => {
  let storage;

  if (Array.isArray(resource.storage)) {
    storage = resource.storage.map(x => parseInt(x.quantity.val)).reduce((a, b) => a + b, 0);
  } else {
    storage = parseInt(resource.storage.quantity.val);
  }

  return storage;
};

export function leaseToDto(lease: RpcLease, deployment: RpcDeployment): LeaseDto {
  const group = deployment ? deployment.groups.filter(g => g.group_id.gseq === lease.lease.lease_id.gseq)[0] : ({} as any);
  return {
    id: lease.lease.lease_id.dseq + lease.lease.lease_id.gseq + lease.lease.lease_id.oseq,
    owner: lease.lease.lease_id.owner,
    provider: lease.lease.lease_id.provider,
    dseq: lease.lease.lease_id.dseq,
    gseq: lease.lease.lease_id.gseq,
    oseq: lease.lease.lease_id.oseq,
    state: lease.lease.state,
    price: lease.lease.price,
    cpuAmount: deployment ? deploymentGroupResourceSum(group, r => parseInt(r.cpu.units.val) / 1000) : undefined,
    gpuAmount: deployment ? deploymentGroupResourceSum(group, r => parseInt(r.gpu?.units?.val || 0)) : undefined,
    memoryAmount: deployment ? deploymentGroupResourceSum(group, r => parseInt(r.memory.quantity.val)) : undefined,
    storageAmount: deployment
      ? deploymentGroupResourceSum(group, r =>
          convertToArrayIfNeeded(r.storage)
            .map(x => parseInt(x.quantity.val))
            .reduce((a, b) => a + b, 0)
        )
      : undefined,
    group
  };
}
