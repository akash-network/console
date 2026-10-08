import type { DeploymentInfo, RpcLease } from "@akashnetwork/http-sdk";

import type { ListDeploymentsItem } from "@src/deployment/http-schemas/deployment.schema";
import type { ListedDeploymentSetting } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { leaseGpuKeyOf, type LeaseGpusByLease } from "@src/deployment/services/lease-gpu/lease-gpu.service";

export function toDeploymentListItem({
  deployment,
  leases,
  setting,
  leaseGpus
}: {
  deployment: DeploymentInfo;
  leases: RpcLease["lease"][];
  setting: ListedDeploymentSetting | undefined;
  leaseGpus: LeaseGpusByLease | undefined;
}): ListDeploymentsItem {
  return {
    deployment: deployment.deployment,
    groups: deployment.groups,
    leases: withLeaseGpus(leases, leaseGpus),
    escrow_account: deployment.escrow_account,
    name: setting?.name ?? null,
    settings: setting ? { ...setting, runtimeEndsAt: setting.runtimeEndsAt?.toISOString() ?? null } : null
  };
}

/** A lease the console recorded nothing for carries neither field at all, rather than an empty one that would read as "no gpu". */
export function withLeaseGpus<T extends { id: { gseq: number; oseq: number; provider: string } }>(leases: T[], byLease: LeaseGpusByLease | undefined): T[] {
  if (!byLease?.size) return leases;

  return leases.map(lease => ({ ...lease, ...byLease.get(leaseGpuKeyOf(lease.id)) }));
}
