import { subject } from "@casl/ability";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { getPostgresError } from "@src/core/repositories/base.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { type BudgetPeriod, budgetPeriodOf } from "@src/organization/lib/budget-period/budget-period";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import {
  PROJECT_BUDGET_UNIQUE_CONSTRAINT,
  type ProjectBudgetInput,
  type ProjectBudgetOutput,
  ProjectBudgetRepository
} from "@src/organization/repositories/project-budget/project-budget.repository";

export type ProjectBudgetSettings = Pick<ProjectBudgetInput, "monthlyAmountCents" | "alertThresholdPercent" | "stopTopUps">;

export type ProjectBudgetWithPeriod = ProjectBudgetOutput & { period: BudgetPeriod; periodCommittedCents: number };

export const PROJECT_BUDGET_EXISTS_ERROR_CODE = "project_budget_exists";

@singleton()
export class ProjectBudgetService {
  constructor(
    private readonly projectBudgetRepository: ProjectBudgetRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  /** A caller no rule lets read any budget gets an empty list, as `listProjects` answers a member granted no project. */
  async list(query: { projectId?: string }): Promise<ProjectBudgetWithPeriod[]> {
    const organizationId = this.#activeOrganizationId();

    if (!this.authService.ability.can("read", "ProjectBudget")) return [];

    const budgets = await this.projectBudgetRepository
      .accessibleBy(this.authService.ability, "read")
      .find({ organizationId, ...(query.projectId && { projectId: query.projectId }) });

    return await Promise.all(budgets.map(budget => this.#withPeriod(budget)));
  }

  async create(input: { projectId: string } & ProjectBudgetSettings): Promise<ProjectBudgetWithPeriod> {
    const organizationId = this.#activeOrganizationId();
    const project = await this.projectRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id: input.projectId, deletedAt: null });

    if (!project) {
      throw createError(404, "Project not found");
    }

    this.#assertCan("create", { organizationId, projectId: project.id });

    const budget = await rejectExistingBudget(() =>
      this.projectBudgetRepository.create({ ...input, organizationId, createdByUserId: this.authService.currentUser.id })
    );

    return await this.#withPeriod(budget);
  }

  async update(id: string, changes: Partial<ProjectBudgetSettings>): Promise<ProjectBudgetWithPeriod> {
    const budget = await this.#findReadable(id);
    this.#assertCan("update", budget);

    const updated = await this.projectBudgetRepository.accessibleBy(this.authService.ability, "update").updateBy({ id }, changes, { returning: true });

    return await this.#withPeriod(updated ?? budget);
  }

  async delete(id: string): Promise<void> {
    const budget = await this.#findReadable(id);
    this.#assertCan("delete", budget);

    await this.projectBudgetRepository.accessibleBy(this.authService.ability, "delete").deleteById(id);
  }

  async #findReadable(id: string): Promise<ProjectBudgetOutput> {
    const budget = await this.projectBudgetRepository.accessibleBy(this.authService.ability, "read").findOneBy({ id });

    if (!budget) {
      throw createError(404, "Project budget not found");
    }

    return budget;
  }

  #assertCan(action: string, budget: Pick<ProjectBudgetOutput, "organizationId" | "projectId">): void {
    if (!this.authService.ability.can(action, subject("ProjectBudget", { organizationId: budget.organizationId, projectId: budget.projectId }))) {
      throw createError(403, "Only owners and admins can change project budgets");
    }
  }

  /** The committed figure is the one a deposit is judged against: what the console recorded this month, not the chain's history before the ledger. */
  async #withPeriod(budget: ProjectBudgetOutput): Promise<ProjectBudgetWithPeriod> {
    const period = budgetPeriodOf(new Date());
    const periodCommittedCents = await this.deploymentDepositRepository.sumCommittedInProject(budget.organizationId, budget.projectId, period);

    return { ...budget, period, periodCommittedCents };
  }

  #activeOrganizationId(): string {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (!context) {
      throw createError(403, "Project budgets belong to an organization and this request runs in none");
    }

    return context.organizationId;
  }
}

async function rejectExistingBudget(create: () => Promise<ProjectBudgetOutput>): Promise<ProjectBudgetOutput> {
  try {
    return await create();
  } catch (error) {
    if (getPostgresError(error)?.constraint_name === PROJECT_BUDGET_UNIQUE_CONSTRAINT) {
      throw createError(409, "The project already has a budget", { errorCode: PROJECT_BUDGET_EXISTS_ERROR_CODE });
    }

    throw error;
  }
}
