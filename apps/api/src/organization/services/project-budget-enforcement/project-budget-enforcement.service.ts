import { inject, singleton } from "tsyringe";

import { type DeploymentDepositInput, DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { type BudgetPeriod, budgetPeriodOf } from "@src/organization/lib/budget-period/budget-period";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { type ProjectBudgetOutput, ProjectBudgetRepository } from "@src/organization/repositories/project-budget/project-budget.repository";
import { ProjectBudgetAlert } from "@src/organization/services/project-budget-alert/project-budget-alert.handler";

export const PROJECT_BUDGET_EXCEEDED_ERROR_CODE = "project_budget_exceeded";

export type BudgetedDeposit = Pick<DeploymentDepositInput, "organizationId" | "projectId" | "dseq" | "kind" | "amountCents">;

type Verdict = {
  budget: ProjectBudgetOutput;
  deposits: BudgetedDeposit[];
  committedCents: number;
  incomingCents: number;
  isRefused: boolean;
};

const ALERT_RECIPIENT_ROLES: readonly OrganizationRole[] = ["owner", "admin"];

/** Shaped so `isHttpError` accepts it, which lets the refusal reach the client with its code while the dseqs stay for the callers that skip them. */
export class ProjectBudgetExceededError extends Error {
  readonly expose = true;
  readonly status = 403;
  readonly statusCode = 403;
  readonly errorCode = PROJECT_BUDGET_EXCEEDED_ERROR_CODE;
  readonly data: { projectIds: string[] };

  constructor(
    readonly dseqs: readonly string[],
    projectIds: string[]
  ) {
    super("This would take the project past its monthly budget, so it was not signed. An owner or admin can raise the budget.");
    this.name = new.target.name;
    this.data = { projectIds };
  }
}

export function isProjectBudgetExceeded(error: unknown): error is ProjectBudgetExceededError {
  return error instanceof ProjectBudgetExceededError;
}

/** Holds deposits to the monthly budgets of their projects: creates always, top-ups only where the budget stops them. */
@singleton()
export class ProjectBudgetEnforcementService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly projectBudgetRepository: ProjectBudgetRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProjectBudgetEnforcementService.name });
  }

  /** Judges the deposits under each budget's row lock and runs `record` only if all allow them; a due alert is queued in that transaction. */
  async enforce<T>(deposits: BudgetedDeposit[], record?: () => Promise<T>): Promise<T | undefined> {
    const period = budgetPeriodOf(new Date());

    const outcome = await this.txService.transaction(async () => {
      const verdicts = await this.#judge(deposits, period);
      await this.#alertWhereDue(verdicts, period, { isRecording: !!record });

      const refused = verdicts.filter(({ isRefused }) => isRefused);

      if (refused.length) {
        return { refusal: refusalOf(refused) };
      }

      return { recorded: await record?.() };
    });

    if (outcome.refusal) {
      this.logger.info({ event: "PROJECT_BUDGET_DEPOSIT_REFUSED", projectIds: outcome.refusal.data.projectIds, dseqs: outcome.refusal.dseqs });
      throw outcome.refusal;
    }

    return outcome.recorded;
  }

  async #judge(deposits: BudgetedDeposit[], period: BudgetPeriod): Promise<Verdict[]> {
    const verdicts: Verdict[] = [];

    for (const projectId of projectIdsOf(deposits)) {
      const inProject = deposits.filter(deposit => deposit.projectId === projectId);
      const { organizationId } = inProject[0];
      const budget = await this.projectBudgetRepository.findOneByAndLock({ organizationId, projectId }, { strength: "no key update" });

      if (!budget) continue;

      const committedCents = await this.deploymentDepositRepository.sumCommittedInProject(organizationId, projectId, period);
      const incomingCents = inProject.reduce((total, { amountCents }) => total + amountCents, 0);
      const isPastBudget = committedCents + incomingCents > budget.monthlyAmountCents;
      const isHeld = inProject.some(({ kind }) => kind === "deployment_create" || budget.stopTopUps);

      verdicts.push({ budget, deposits: inProject, committedCents, incomingCents, isRefused: isPastBudget && isHeld });
    }

    return verdicts;
  }

  /** Alerts with the recorded deposit that crosses the threshold, or at the latest the first refusal; a judge-only check alerts on a refusal alone. */
  async #alertWhereDue(verdicts: Verdict[], period: BudgetPeriod, { isRecording }: { isRecording: boolean }): Promise<void> {
    for (const verdict of verdicts) {
      const { budget, committedCents, incomingCents, isRefused } = verdict;
      const committedAfter = isRefused ? committedCents : committedCents + incomingCents;
      const crossesThreshold = (committedCents + incomingCents) * 100 >= budget.monthlyAmountCents * budget.alertThresholdPercent;

      if (budget.alertedForPeriod === period.key || !(isRefused || (isRecording && crossesThreshold))) continue;

      await this.projectBudgetRepository.updateById(budget.id, { alertedForPeriod: period.key });

      for (const userId of await this.#alertRecipientsOf(budget.organizationId)) {
        await this.jobQueueService.enqueue(
          new ProjectBudgetAlert({
            userId,
            organizationId: budget.organizationId,
            projectId: budget.projectId,
            period: period.key,
            committedCents: committedAfter,
            refusedCents: isRefused ? incomingCents : 0
          })
        );
      }

      this.logger.info({ event: "PROJECT_BUDGET_ALERT_QUEUED", projectId: budget.projectId, period: period.key, isRefused });
    }
  }

  async #alertRecipientsOf(organizationId: string): Promise<string[]> {
    const members = await Promise.all(ALERT_RECIPIENT_ROLES.map(role => this.organizationMemberRepository.find({ organizationId, role })));

    return members.flat().map(({ userId }) => userId);
  }
}

function projectIdsOf(deposits: BudgetedDeposit[]): string[] {
  return [...new Set(deposits.map(({ projectId }) => projectId).filter((projectId): projectId is string => !!projectId))].sort();
}

function refusalOf(refused: Verdict[]): ProjectBudgetExceededError {
  return new ProjectBudgetExceededError(
    refused.flatMap(({ deposits }) => deposits.map(({ dseq }) => dseq)),
    refused.map(({ budget }) => budget.projectId)
  );
}
