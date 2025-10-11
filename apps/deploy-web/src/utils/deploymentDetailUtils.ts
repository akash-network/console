import type { DeploymentDto, DeploymentGroup, DeploymentResource_V2, DeploymentResource_V3, LeaseDto, RpcDeployment, RpcLease } from "@src/types/deployment";
import { coinToUDenom } from "./priceUtils";

export function deploymentResourceSum(deployment: RpcDeployment, resourceMapper: (resource: DeploymentResource_V2 | DeploymentResource_V3) => number): number {
  return deployment.groups.map(g => g.group_spec.resources.map(r => r.count * resourceMapper(r.resource)).reduce((a, b) => a + b)).reduce((a, b) => a + b);
}

export function deploymentGroupResourceSum(
  group: DeploymentGroup,
  resourceMapper: (resource: DeploymentResource_V2 | DeploymentResource_V3) => number
): number {
  if (!group || !group.group_spec || !group.group_spec) return 0;

  return group.group_spec.resources.map(r => r.count * resourceMapper(r.resource)).reduce((a, b) => a + b);
}

export function deploymentToDto(d: RpcDeployment): DeploymentDto {
  let escrowBalanceUAkt = 0;
  if (d.escrow_account.state.funds.length > 0) {
    escrowBalanceUAkt = d.escrow_account.state.funds.reduce((sum, fund) => sum + coinToUDenom(fund), 0);
  }

  // Sum all transferred amounts
  let totalTransferred = { denom: "", amount: "0" };
  if (d.escrow_account.state.transferred.length > 0) {
    const totalAmount = d.escrow_account.state.transferred.reduce((sum, transfer) => {
      return sum + coinToUDenom(transfer);
    }, 0);
    totalTransferred = {
      denom: d.escrow_account.state.transferred[0].denom,
      amount: totalAmount.toString()
    };
  }

  return {
    dseq: d.deployment.id.dseq,
    state: d.deployment.state,
    hash: d.deployment.hash,
    denom: d.escrow_account.state.funds.length > 0 ? d.escrow_account.state.funds[0].denom : "",
    createdAt: parseInt(d.deployment.created_at),
    escrowBalance: escrowBalanceUAkt,
    transferred: totalTransferred,
    cpuAmount: deploymentResourceSum(d, r => parseInt(r.cpu.units.val) / 1000),
    gpuAmount: deploymentResourceSum(d, r => parseInt(r.gpu?.units?.val || "0")),
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

export const getStorageAmount = (resource: DeploymentResource_V2 | DeploymentResource_V3): number => {
  let storage: number;

  if (Array.isArray(resource.storage)) {
    storage = resource.storage.map(x => parseInt(x.quantity.val)).reduce((a, b) => a + b, 0);
  } else {
    storage = parseInt((resource.storage as { quantity: { val: string } })?.quantity?.val || "0");
  }

  return storage;
};

export function leaseToDto(lease: RpcLease, deployment: Pick<RpcDeployment, "groups">): LeaseDto {
  const group = deployment ? deployment.groups.filter(g => g.id.gseq === lease.lease.lease_id.gseq)[0] : ({} as DeploymentGroup);
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
    gpuAmount: deployment ? deploymentGroupResourceSum(group, r => parseInt(r.gpu?.units?.val || "0")) : undefined,
    memoryAmount: deployment ? deploymentGroupResourceSum(group, r => parseInt(r.memory.quantity.val)) : undefined,
    storageAmount: deployment
      ? deploymentGroupResourceSum(group, r =>
          convertToArrayIfNeeded(r.storage)
            .map(x => parseInt(x.quantity.val))
            .reduce((a, b) => a + b, 0)
        )
      : undefined,
    group
  } as LeaseDto;
}
