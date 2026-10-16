import { subject } from "@casl/ability";
import { addDays } from "date-fns";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { type DailyDeploymentConsumption, DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { WALLET_MIGRATION_DATE } from "@src/billing/repositories/usage/usage.repository";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentSettingRepository, type NamedDeploymentFiling } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";

export type SpendRange = { startDate: string; endDate: string };

export type SpendAmounts = { committedCents: number; consumedCents: number; estimatedConsumedCents: number };

export type ProjectSpend = SpendAmounts & { project: ProjectOutput };

/** `unassigned` and `total` are null for a caller who may not see the whole organization's spend. */
export type ProjectSpendReport = SpendRange & {
  projects: ProjectSpend[];
  unassigned: SpendAmounts | null;
  total: SpendAmounts | null;
};

export type DailyProjectSpend = { date: string; projectId: string | null; consumedCents: number };

export type DeploymentSpend = { dseq: string; name: string | null; projectId: string | null; consumedCents: number; hours: number };

/** Deployments filed in no project show only to a caller who may see the whole organization's spend. */
export type DeploymentSpendReport = SpendRange & {
  projects: ProjectOutput[];
  days: DailyProjectSpend[];
  deployments: DeploymentSpend[];
};

type SpendByProject = Map<string | null, SpendAmounts>;

type VisibleProjects = { seesOrganization: boolean; projects: ProjectOutput[] };

const MICRO_USD_PER_CENT = 10_000;

const NO_SPEND: SpendAmounts = { committedCents: 0, consumedCents: 0, estimatedConsumedCents: 0 };

@singleton()
export class ProjectSpendService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentSpendRepository: DeploymentSpendRepository,
    private readonly txManagerService: TxManagerService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProjectSpendService.name });
  }

  async report(range: SpendRange): Promise<ProjectSpendReport> {
    const organizationId = this.#activeOrganizationId();
    const { seesOrganization, projects } = await this.#visibleProjects(organizationId);

    if (!seesOrganization && !projects.length) {
      return { ...range, projects: [], unassigned: null, total: null };
    }

    const spend = await this.#spendByProject(organizationId, range);

    return {
      ...range,
      projects: listedProjects(projects, spend).map(project => ({ project, ...(spend.get(project.id) ?? NO_SPEND) })),
      unassigned: seesOrganization ? spend.get(null) ?? NO_SPEND : null,
      total: seesOrganization ? [...spend.values()].reduce(addSpend, NO_SPEND) : null
    };
  }

  /** What each deployment the caller can see consumed over the range, with each project's share of every day. */
  async breakdown(range: SpendRange): Promise<DeploymentSpendReport> {
    const organizationId = this.#activeOrganizationId();
    const { seesOrganization, projects } = await this.#visibleProjects(organizationId);

    if (!seesOrganization && !projects.length) {
      return { ...range, projects: [], days: [], deployments: [] };
    }

    const consumption = await this.deploymentSpendRepository.findDailyConsumption({ owners: await this.#ownersOf(organizationId), ...range });
    const filings = await this.deploymentSettingRepository.findNamedFilingsInOrganizationByDseqs(
      organizationId,
      consumption.map(({ dseq }) => dseq)
    );
    const visibleProjectIds = new Set(projects.map(({ id }) => id));
    const projectIdOf = (dseq: string) => filings.get(dseq)?.projectId ?? null;
    const visible = consumption.filter(({ dseq }) => {
      const projectId = projectIdOf(dseq);

      return projectId ? visibleProjectIds.has(projectId) : seesOrganization;
    });
    const deployments = deploymentSpendOf(visible, filings);

    return {
      ...range,
      projects: listedProjects(projects, new Set(deployments.map(({ projectId }) => projectId))),
      days: dailyProjectSpendOf(visible, projectIdOf),
      deployments
    };
  }

  async #visibleProjects(organizationId: string): Promise<VisibleProjects> {
    const ability = this.authService.ability;
    const seesOrganization = ability.can("read", subject("OrganizationSpend", { organizationId }));
    const projects = (await this.projectRepository.find({ organizationId })).filter(({ id }) =>
      ability.can("read", subject("ProjectSpend", { organizationId, projectId: id }))
    );

    return { seesOrganization, projects };
  }

  /** Every figure is rounded to whole cents per deployment before it is summed, so the projects and the remainder add up to the total exactly. */
  async #spendByProject(organizationId: string, { startDate, endDate }: SpendRange): Promise<SpendByProject> {
    const from = new Date(`${startDate}T00:00:00.000Z`);
    const to = addDays(new Date(`${endDate}T00:00:00.000Z`), 1);
    const [owners, firstRecordedAt] = await Promise.all([this.#ownersOf(organizationId), this.deploymentDepositRepository.findFirstRecordedAt(organizationId)]);
    const [recorded, deposited, consumed] = await Promise.all([
      this.deploymentDepositRepository.sumCommittedByProject(organizationId, { from, to }),
      this.deploymentSpendRepository.findDepositedByDeployment({ owners, from, to: firstRecordedAt && firstRecordedAt < to ? firstRecordedAt : to }),
      this.deploymentSpendRepository.findConsumedByDeployment({ owners, startDate, endDate })
    ]);
    const projectIds = await this.deploymentSettingRepository.findProjectIdsInOrganizationByDseqs(
      organizationId,
      [...deposited, ...consumed].map(({ dseq }) => dseq)
    );
    const spend: SpendByProject = new Map();
    const add = (projectId: string | null, amounts: Partial<SpendAmounts>) => spend.set(projectId, addSpend(spend.get(projectId) ?? NO_SPEND, amounts));

    recorded.forEach(({ projectId, amountCents }) => add(projectId, { committedCents: amountCents }));
    deposited.forEach(({ dseq, depositedMicroUsd }) => add(projectIds.get(dseq) ?? null, { committedCents: toCents(depositedMicroUsd) }));
    consumed.forEach(({ dseq, settledMicroUsd, accruedMicroUsd }) => {
      const estimatedConsumedCents = toCents(accruedMicroUsd);
      add(projectIds.get(dseq) ?? null, { consumedCents: toCents(settledMicroUsd) + estimatedConsumedCents, estimatedConsumedCents });
    });

    return spend;
  }

  /** A wallet made before the derivation migration also spent from its earlier address, as the usage history counts it. */
  async #ownersOf(organizationId: string): Promise<string[]> {
    const wallet = await this.userWalletRepository.findOneBy({ organizationId });

    if (!wallet?.address) return [];

    if (wallet.createdAt >= WALLET_MIGRATION_DATE) return [wallet.address];

    try {
      const earlierAddress = await this.txManagerService.getDerivedWalletAddress(wallet.id, { walletVersion: "v1" });

      return [...new Set([wallet.address, earlierAddress])];
    } catch (error) {
      this.logger.error({ event: "PROJECT_SPEND_EARLIER_ADDRESS_UNAVAILABLE", walletId: wallet.id, error });
      return [wallet.address];
    }
  }

  #activeOrganizationId(): string {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (!context) {
      throw createError(403, "Spend is reported for an organization and this request runs in none");
    }

    return context.organizationId;
  }
}

function toCents(microUsd: string | number): number {
  return Math.round(Number(microUsd) / MICRO_USD_PER_CENT);
}

function deploymentSpendOf(consumption: DailyDeploymentConsumption[], filings: Map<string, NamedDeploymentFiling>): DeploymentSpend[] {
  const totals = new Map<string, { microUsd: number; hours: number }>();

  consumption.forEach(({ dseq, consumedMicroUsd, hours }) => {
    const total = totals.get(dseq) ?? { microUsd: 0, hours: 0 };
    totals.set(dseq, { microUsd: total.microUsd + Number(consumedMicroUsd), hours: total.hours + hours });
  });

  return [...totals]
    .map(([dseq, { microUsd, hours }]) => ({
      dseq,
      name: filings.get(dseq)?.name ?? null,
      projectId: filings.get(dseq)?.projectId ?? null,
      consumedCents: toCents(microUsd),
      hours: Math.round(hours * 100) / 100
    }))
    .sort((left, right) => right.consumedCents - left.consumedCents || left.dseq.localeCompare(right.dseq));
}

/** A project's deployments are summed before the day is rounded, so many small ones still add up to the cents they cost together. */
function dailyProjectSpendOf(consumption: DailyDeploymentConsumption[], projectIdOf: (dseq: string) => string | null): DailyProjectSpend[] {
  const days = new Map<string, { date: string; projectId: string | null; microUsd: number }>();

  consumption.forEach(({ dseq, date, consumedMicroUsd }) => {
    const projectId = projectIdOf(dseq);
    const key = `${date}/${projectId}`;
    const day = days.get(key) ?? { date, projectId, microUsd: 0 };
    days.set(key, { ...day, microUsd: day.microUsd + Number(consumedMicroUsd) });
  });

  return [...days.values()]
    .map(({ date, projectId, microUsd }) => ({ date, projectId, consumedCents: toCents(microUsd) }))
    .filter(({ consumedCents }) => consumedCents > 0);
}

/** A deleted project shows only while it has spend to account for. */
function listedProjects(projects: ProjectOutput[], projectIdsWithSpend: { has: (projectId: string) => boolean }): ProjectOutput[] {
  return projects.filter(({ id, deletedAt }) => !deletedAt || projectIdsWithSpend.has(id)).sort(byListingOrder);
}

function addSpend(spend: SpendAmounts, amounts: Partial<SpendAmounts>): SpendAmounts {
  return {
    committedCents: spend.committedCents + (amounts.committedCents ?? 0),
    consumedCents: spend.consumedCents + (amounts.consumedCents ?? 0),
    estimatedConsumedCents: spend.estimatedConsumedCents + (amounts.estimatedConsumedCents ?? 0)
  };
}

function byListingOrder(left: ProjectOutput, right: ProjectOutput): number {
  return (
    Number(!!left.deletedAt) - Number(!!right.deletedAt) ||
    Number(right.isDefault) - Number(left.isDefault) ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}
