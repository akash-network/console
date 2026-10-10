import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentListState, ListDeploymentsItem, ListDeploymentsQuery } from "@src/deployment/http-schemas/deployment.schema";
import { closureKey, normalizeDseq } from "@src/deployment/lib/deployment-closure-key/deployment-closure-key";
import { toDeploymentListItem } from "@src/deployment/lib/deployment-list-item/deployment-list-item";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository, type ReachableDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export type DeploymentListPage = { deployments: ListDeploymentsItem[]; total: number | null; hasMore: boolean };

const EMPTY_PAGE: DeploymentListPage = { deployments: [], total: 0, hasMore: false };

/** Lists a caller's deployments: by their wallet outside organization mode, by the projects they reach within it. */
@singleton()
export class DeploymentListService {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly leaseGpuService: LeaseGpuService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async list(query: ListDeploymentsQuery): Promise<DeploymentListPage> {
    const context = this.#organizationModeContext();

    if (!context) {
      return await this.#listWallet(query);
    }

    if (listsWholeWallet(context, query.projectId)) {
      return await this.#withProjectIds(await this.#listWallet(query));
    }

    return await this.#listReachable(context, query);
  }

  async #listWallet({ state, reverse, search, skip, limit }: ListDeploymentsQuery): Promise<DeploymentListPage> {
    return await this.deploymentReaderService.list({ query: { userId: this.authService.currentUser.id }, state, reverse, search, skip, limit });
  }

  async #withProjectIds(page: DeploymentListPage): Promise<DeploymentListPage> {
    const projectIds = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findProjectIdsByDseqs({
      userId: this.authService.currentUser.id,
      dseqs: page.deployments.map(({ deployment }) => deployment.id.dseq)
    });

    return { ...page, deployments: page.deployments.map(item => ({ ...item, projectId: projectIds.get(item.deployment.id.dseq) ?? null })) };
  }

  async #listReachable(context: OrganizationContext, { projectId, search, state, reverse, skip, limit }: ListDeploymentsQuery): Promise<DeploymentListPage> {
    if (!this.authService.ability.can("read", "DeploymentSetting")) {
      return EMPTY_PAGE;
    }

    const reachable = await this.deploymentSettingRepository
      .accessibleBy(this.authService.ability, "read")
      .findReachable({ organizationId: context.organizationId, projectId, search });
    const matching = (await this.#inState(oneRowPerDeployment(reachable), state)).sort(byDseq(reverse));

    return {
      deployments: await this.#readFromChain(matching.slice(skip, skip + limit)),
      total: matching.length,
      hasMore: skip + limit < matching.length
    };
  }

  /** The console's closed flag trails the chain, so the state is read from the chain index; a deployment it has not indexed yet is in neither state. */
  async #inState(deployments: ReachableDeployment[], state: DeploymentListState): Promise<ReachableDeployment[]> {
    const closureStates = await this.deploymentRepository.findClosureStates(deployments.map(({ owner, dseq }) => ({ owner, dseq: normalizeDseq(dseq) })));
    const isClosedByKey = new Map(closureStates.map(closureState => [closureKey(closureState), closureState.isClosed]));

    return deployments.filter(deployment => isClosedByKey.get(closureKey(deployment)) === (state === "closed"));
  }

  async #readFromChain(page: ReachableDeployment[]): Promise<ListDeploymentsItem[]> {
    const [onChain, leaseGpus] = await Promise.all([
      Promise.all(page.map(({ owner, dseq }) => this.deploymentReaderService.findListedByOwnerAndDseq(owner, dseq))),
      this.leaseGpuService.findForDeploymentSettings(page.map(({ id }) => id))
    ]);

    return page.flatMap((reachable, index) => {
      const listed = onChain[index];

      if (!listed) return [];

      return [{ ...toDeploymentListItem({ ...listed, setting: reachable.setting, leaseGpus: leaseGpus.get(reachable.id) }), projectId: reachable.projectId }];
    });
  }

  #organizationModeContext(): OrganizationContext | undefined {
    const context = this.executionContextService.hasContext() ? this.executionContextService.get("ORGANIZATION_CONTEXT") : undefined;

    return context?.mode === "organization" ? context : undefined;
  }
}

/** A personal organization's wallet holds only its own deployments, so its whole list still comes from the wallet and keeps those the console never recorded. */
function listsWholeWallet({ organizationType, projectScope }: OrganizationContext, projectId: string | undefined): boolean {
  return organizationType === "personal" && projectScope.kind === "all" && !projectId;
}

function oneRowPerDeployment(rows: ReachableDeployment[]): ReachableDeployment[] {
  const byDeployment = new Map<string, ReachableDeployment>();

  for (const row of rows) {
    if (!byDeployment.has(closureKey(row))) byDeployment.set(closureKey(row), row);
  }

  return [...byDeployment.values()];
}

/** Numeric order without parsing, since a dseq is a run of digits: a shorter one is smaller, and equal lengths compare as text. */
function byDseq(reverse: boolean) {
  const direction = reverse ? -1 : 1;

  return (one: ReachableDeployment, other: ReachableDeployment) => {
    const [oneDseq, otherDseq] = [normalizeDseq(one.dseq), normalizeDseq(other.dseq)];

    return direction * (oneDseq.length - otherDseq.length || oneDseq.localeCompare(otherDseq) || one.owner.localeCompare(other.owner));
  };
}
