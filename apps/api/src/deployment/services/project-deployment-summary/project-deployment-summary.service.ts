import groupBy from "lodash/groupBy";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { closureKey, normalizeDseq } from "@src/deployment/lib/deployment-closure-key/deployment-closure-key";
import { type DeploymentKey, type DeploymentLeaseState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository, type UnclosedReachableDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { UNINDEXED_DEPLOYMENT_GRACE_MINUTES } from "@src/deployment/services/deployment-list/deployment-list.service";
import { MAX_SEARCHABLE_DEPLOYMENTS } from "@src/deployment/services/deployment-reader/deployment-reader.service";

/** A project folder files at most this many deployments, so no more of them are previewed. */
export const PROJECT_DEPLOYMENT_PREVIEW_SIZE = 3;

/** Read from the chain index: `pending` holds no lease yet, `degraded` lost every lease it had while staying open. */
export type ProjectDeploymentStatus = "pending" | "running" | "degraded";

export type ProjectDeploymentPreview = { dseq: string; name: string | null; status: ProjectDeploymentStatus };

export type ProjectDeploymentSummary = { activeCount: number; preview: ProjectDeploymentPreview[] };

@singleton()
export class ProjectDeploymentSummaryService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProjectDeploymentSummaryService.name });
  }

  /** Keyed by project, holding only projects with an active deployment the caller may read; undefined when more are open than the chain index is asked about at once. */
  async summarizeByProject(organizationId: string): Promise<Map<string, ProjectDeploymentSummary> | undefined> {
    const { ability } = this.authService;

    if (!ability.can("read", "DeploymentSetting")) return new Map();

    const unclosed = await this.deploymentSettingRepository
      .accessibleBy(ability, "read")
      .findUnclosedReachable({ organizationId }, { limit: MAX_SEARCHABLE_DEPLOYMENTS + 1, recentMinutes: UNINDEXED_DEPLOYMENT_GRACE_MINUTES });

    if (unclosed.length > MAX_SEARCHABLE_DEPLOYMENTS) {
      this.#logger.warn({ event: "PROJECT_DEPLOYMENT_SUMMARY_TOO_LARGE", organizationId });
      return undefined;
    }

    const openByProject = Object.entries(groupBy((await this.#openOnChain(unclosed)).sort(newestFirst), "projectId"));
    const previewOf = (open: UnclosedReachableDeployment[]) => open.slice(0, PROJECT_DEPLOYMENT_PREVIEW_SIZE);
    const statusOf = statusFrom(await this.deploymentRepository.findLeaseStates(openByProject.flatMap(([, open]) => previewOf(open).map(toChainKey))));

    return new Map(
      openByProject.map(([projectId, open]) => [
        projectId,
        {
          activeCount: open.length,
          preview: previewOf(open).map(deployment => ({ dseq: normalizeDseq(deployment.dseq), name: deployment.name, status: statusOf(deployment) }))
        }
      ])
    );
  }

  /** A row the index has not seen yet counts as open only while it is recent, as the deployment list counts it. */
  async #openOnChain(unclosed: UnclosedReachableDeployment[]): Promise<UnclosedReachableDeployment[]> {
    const filed = unclosed.filter(({ projectId }) => projectId);
    const closureStates = await this.deploymentRepository.findClosureStates(filed.map(toChainKey));
    const isClosedByKey = new Map(closureStates.map(state => [closureKey(state), state.isClosed]));

    return filed.filter(deployment => {
      const isClosed = isClosedByKey.get(closureKey(deployment));
      return isClosed === undefined ? deployment.isRecent : !isClosed;
    });
  }
}

function toChainKey({ owner, dseq }: UnclosedReachableDeployment): DeploymentKey {
  return { owner, dseq: normalizeDseq(dseq) };
}

/** Compared as text, so a dseq above 2^53 keeps its place. */
function newestFirst(a: UnclosedReachableDeployment, b: UnclosedReachableDeployment): number {
  const [left, right] = [normalizeDseq(a.dseq), normalizeDseq(b.dseq)];

  return right.length - left.length || right.localeCompare(left);
}

function statusFrom(leaseStates: DeploymentLeaseState[]): (deployment: UnclosedReachableDeployment) => ProjectDeploymentStatus {
  const byKey = new Map(leaseStates.map(state => [closureKey(state), state]));

  return deployment => {
    const state = byKey.get(closureKey(deployment));

    if (state?.hasOpenLease) return "running";

    return state?.hasLease ? "degraded" : "pending";
  };
}
