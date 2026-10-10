import { PromisePool } from "@supercharge/promise-pool";
import { UnprocessableEntity } from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { ListDeploymentsItem, ListDeploymentsQuery } from "@src/deployment/http-schemas/deployment.schema";
import { closureKey, normalizeDseq } from "@src/deployment/lib/deployment-closure-key/deployment-closure-key";
import { toDeploymentListItem } from "@src/deployment/lib/deployment-list-item/deployment-list-item";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import {
  DeploymentSettingRepository,
  type ReachableDeployment,
  type UnclosedReachableDeployment
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService, MAX_SEARCHABLE_DEPLOYMENTS } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export type DeploymentListPage = { deployments: ListDeploymentsItem[]; total: number | null; hasMore: boolean };

const EMPTY_PAGE: DeploymentListPage = { deployments: [], total: 0, hasMore: false };

/** The chain index trails the chain by a few blocks, so a deployment filed this recently counts as open before the index has seen it. */
export const UNINDEXED_DEPLOYMENT_GRACE_MINUTES = 10;

const CHAIN_READ_CONCURRENCY = 20;

/** Lists a caller's deployments: by their wallet outside organization mode, by the projects they reach within it. */
@singleton()
export class DeploymentListService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly leaseGpuService: LeaseGpuService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentListService.name });
  }

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

  /** Rows flagged closed are closed on chain, so only the unflagged ones are checked against the index, and the page itself is drawn in SQL. */
  async #listReachable(context: OrganizationContext, { projectId, search, state, reverse, skip, limit }: ListDeploymentsQuery): Promise<DeploymentListPage> {
    if (!this.authService.ability.can("read", "DeploymentSetting")) {
      return EMPTY_PAGE;
    }

    const repository = this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read");
    const query = { organizationId: context.organizationId, projectId, search };
    const unclosed = await repository.findUnclosedReachable(query, {
      limit: MAX_SEARCHABLE_DEPLOYMENTS + 1,
      recentMinutes: UNINDEXED_DEPLOYMENT_GRACE_MINUTES
    });

    if (unclosed.length > MAX_SEARCHABLE_DEPLOYMENTS) {
      this.logger.warn({ event: "DEPLOYMENT_LIST_TOO_LARGE", organizationId: context.organizationId, projectId, state });
      throw new UnprocessableEntity(`More than ${MAX_SEARCHABLE_DEPLOYMENTS} open deployments to sort through. Narrow the list to a project instead.`);
    }

    const { openIds, closedIds } = await this.#splitByIndex(unclosed);
    const { deployments, total } = await repository.findReachablePage({
      ...query,
      among: state === "active" ? { ids: openIds } : { flaggedClosedOrIds: closedIds },
      reverse,
      skip,
      limit
    });

    return { deployments: await this.#readFromChain(deployments), total, hasMore: skip + limit < total };
  }

  async #splitByIndex(unclosed: UnclosedReachableDeployment[]): Promise<{ openIds: string[]; closedIds: string[] }> {
    const closureStates = await this.deploymentRepository.findClosureStates(unclosed.map(({ owner, dseq }) => ({ owner, dseq: normalizeDseq(dseq) })));
    const isClosedByKey = new Map(closureStates.map(closureState => [closureKey(closureState), closureState.isClosed]));
    const indexedState = (row: UnclosedReachableDeployment) => isClosedByKey.get(closureKey(row)) ?? (row.isRecent ? false : undefined);

    return {
      openIds: unclosed.filter(row => indexedState(row) === false).map(({ id }) => id),
      closedIds: unclosed.filter(row => indexedState(row) === true).map(({ id }) => id)
    };
  }

  async #readFromChain(page: ReachableDeployment[]): Promise<ListDeploymentsItem[]> {
    const [{ results: onChain }, leaseGpus] = await Promise.all([
      PromisePool.withConcurrency(CHAIN_READ_CONCURRENCY)
        .for(page)
        .handleError(async error => {
          throw error;
        })
        .process(async ({ id, owner, dseq }) => ({ id, listed: await this.deploymentReaderService.findListedByOwnerAndDseq(owner, dseq) })),
      this.leaseGpuService.findForDeploymentSettings(page.map(({ id }) => id))
    ]);
    const listedById = new Map(onChain.map(({ id, listed }) => [id, listed]));

    return page.flatMap(reachable => {
      const listed = listedById.get(reachable.id);

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
