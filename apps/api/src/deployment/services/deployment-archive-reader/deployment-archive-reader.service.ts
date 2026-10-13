import type { RpcLease } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { ListDeploymentsItem } from "@src/deployment/http-schemas/deployment.schema";
import { toDeploymentListItem } from "@src/deployment/lib/deployment-list-item/deployment-list-item";
import type { ClosedDeploymentSearch } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository, type DeploymentWallet } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";
import { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import { LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";

export interface ArchivePageQuery {
  owner: string;
  wallet: DeploymentWallet;
  skip: number;
  limit: number;
  reverse: boolean;
  search?: string;
}

/** Serves the archive from the console's chain index alone, so its rows, leases and count agree with each other and it answers while the chain node is down. */
@singleton()
export class DeploymentArchiveReaderService {
  constructor(
    private readonly fallbackDeploymentReaderService: FallbackDeploymentReaderService,
    private readonly fallbackLeaseReaderService: FallbackLeaseReaderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly leaseGpuService: LeaseGpuService
  ) {}

  async list({
    owner,
    wallet,
    skip,
    limit,
    reverse,
    search
  }: ArchivePageQuery): Promise<{ deployments: ListDeploymentsItem[]; total: number; hasMore: boolean }> {
    const { deployments: page, total } = await this.fallbackDeploymentReaderService.findClosedPage({
      owner,
      skip,
      limit,
      reverse,
      search: search ? await this.#searchMatching(wallet, search) : undefined
    });
    const dseqs = page.map(({ deployment }) => deployment.id.dseq);
    const [leases, settings, leaseGpus] = await Promise.all([
      this.fallbackLeaseReaderService.findByDeployments({ owner, dseqs }),
      this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findListedSettings({ wallet, dseqs }),
      this.leaseGpuService.findForDeployments({ wallet, dseqs })
    ]);
    const leasesByDseq = groupByDseq(leases.map(({ lease }) => lease));

    return {
      deployments: page.map(deployment => {
        const { dseq } = deployment.deployment.id;

        return toDeploymentListItem({ deployment, leases: leasesByDseq.get(dseq) ?? [], setting: settings.get(dseq), leaseGpus: leaseGpus.get(dseq) });
      }),
      total,
      hasMore: skip + page.length < total
    };
  }

  /** A name lives in the console's database and a deployment in the index, so the names are matched first and handed to the index as dseqs. */
  async #searchMatching(wallet: DeploymentWallet, search: string): Promise<ClosedDeploymentSearch> {
    const needle = search.toLowerCase();
    const namedDseqs = await this.deploymentSettingRepository
      .accessibleBy(this.authService.ability, "read")
      .findDseqsByNameContaining({ wallet, text: needle });

    return { dseqContaining: needle, dseqs: namedDseqs };
  }
}

function groupByDseq(leases: RpcLease["lease"][]): Map<string, RpcLease["lease"][]> {
  const byDseq = new Map<string, RpcLease["lease"][]>();

  for (const lease of leases) {
    byDseq.set(lease.id.dseq, [...(byDseq.get(lease.id.dseq) ?? []), lease]);
  }

  return byDseq;
}
