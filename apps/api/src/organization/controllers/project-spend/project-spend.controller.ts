import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { centsToUsd } from "@src/billing/lib/currency/currency";
import type { ListDeploymentSpendQuery, ListDeploymentSpendResponse } from "@src/organization/http-schemas/deployment-spend.schema";
import type { ListProjectSpendQuery, ListProjectSpendResponse, SpendAmountsResponse } from "@src/organization/http-schemas/project-spend.schema";
import { ProjectSpendService, type SpendAmounts } from "@src/organization/services/project-spend/project-spend.service";

@singleton()
export class ProjectSpendController {
  constructor(private readonly projectSpendService: ProjectSpendService) {}

  @Protected()
  async list(query: ListProjectSpendQuery): Promise<ListProjectSpendResponse> {
    const { startDate, endDate, projects, unassigned, total } = await this.projectSpendService.report(query);
    const figures = [...projects, ...(unassigned ? [unassigned] : []), ...(total ? [total] : [])];

    return {
      data: {
        startDate,
        endDate,
        isEstimated: figures.some(({ estimatedConsumedCents }) => estimatedConsumedCents > 0),
        projects: projects.map(({ project, ...amounts }) => ({
          projectId: project.id,
          name: project.name,
          isDefault: project.isDefault,
          isDeleted: !!project.deletedAt,
          ...toUsd(amounts)
        })),
        unassigned: unassigned && toUsd(unassigned),
        total: total && toUsd(total)
      }
    };
  }

  @Protected()
  async listDeployments(query: ListDeploymentSpendQuery): Promise<ListDeploymentSpendResponse> {
    const { startDate, endDate, projects, days, deployments } = await this.projectSpendService.breakdown(query);

    return {
      data: {
        startDate,
        endDate,
        projects: projects.map(project => ({ projectId: project.id, name: project.name, isDefault: project.isDefault, isDeleted: !!project.deletedAt })),
        days: days.map(({ consumedCents, ...day }) => ({ ...day, consumedUsd: centsToUsd(consumedCents) })),
        deployments: deployments.map(({ consumedCents, ...deployment }) => ({ ...deployment, consumedUsd: centsToUsd(consumedCents) }))
      }
    };
  }
}

function toUsd({ committedCents, consumedCents, estimatedConsumedCents }: SpendAmounts): SpendAmountsResponse {
  return { committedUsd: centsToUsd(committedCents), consumedUsd: centsToUsd(consumedCents), estimatedConsumedUsd: centsToUsd(estimatedConsumedCents) };
}
