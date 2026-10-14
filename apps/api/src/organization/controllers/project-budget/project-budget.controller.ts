import { subDays } from "date-fns";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { centsToUsd, usdToCents } from "@src/billing/lib/currency/currency";
import type {
  CreateProjectBudgetRequest,
  ListProjectBudgetsResponse,
  ProjectBudgetResponse,
  ProjectBudgetResponseItem,
  UpdateProjectBudgetRequest
} from "@src/organization/http-schemas/project-budget.schema";
import {
  ProjectBudgetService,
  type ProjectBudgetSettings,
  type ProjectBudgetWithPeriod
} from "@src/organization/services/project-budget/project-budget.service";

@singleton()
export class ProjectBudgetController {
  constructor(private readonly projectBudgetService: ProjectBudgetService) {}

  @Protected()
  async list(query: { projectId?: string }): Promise<ListProjectBudgetsResponse> {
    return { data: (await this.projectBudgetService.list(query)).map(toProjectBudgetResponse) };
  }

  @Protected()
  async create({ projectId, monthlyAmountUsd, ...settings }: CreateProjectBudgetRequest["data"]): Promise<ProjectBudgetResponse> {
    const budget = await this.projectBudgetService.create({ projectId, ...toSettings(settings), monthlyAmountCents: usdToCents(monthlyAmountUsd) });

    return { data: toProjectBudgetResponse(budget) };
  }

  @Protected()
  async update(id: string, changes: UpdateProjectBudgetRequest["data"]): Promise<ProjectBudgetResponse> {
    return { data: toProjectBudgetResponse(await this.projectBudgetService.update(id, toSettings(changes))) };
  }

  @Protected()
  async delete(id: string): Promise<void> {
    await this.projectBudgetService.delete(id);
  }
}

function toSettings({ monthlyAmountUsd, alertThresholdPercent, stopTopUps }: UpdateProjectBudgetRequest["data"]): Partial<ProjectBudgetSettings> {
  return {
    ...(monthlyAmountUsd !== undefined && { monthlyAmountCents: usdToCents(monthlyAmountUsd) }),
    ...(alertThresholdPercent !== undefined && { alertThresholdPercent }),
    ...(stopTopUps !== undefined && { stopTopUps })
  };
}

function toProjectBudgetResponse(budget: ProjectBudgetWithPeriod): ProjectBudgetResponseItem {
  return {
    id: budget.id,
    projectId: budget.projectId,
    monthlyAmountUsd: centsToUsd(budget.monthlyAmountCents),
    alertThresholdPercent: budget.alertThresholdPercent,
    stopTopUps: budget.stopTopUps,
    currentPeriod: {
      startDate: budget.period.key,
      endDate: subDays(budget.period.to, 1).toISOString().slice(0, 10),
      committedUsd: centsToUsd(budget.periodCommittedCents)
    },
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString()
  };
}
