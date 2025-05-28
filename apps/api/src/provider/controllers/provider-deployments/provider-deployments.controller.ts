import { singleton } from "tsyringe";

import { ProviderDeploymentsQuery, ProviderDeploymentsResponse } from "@src/provider/http-schemas/provider-deployments.schema";
import { ProviderDeploymentsService } from "@src/provider/services/provider-deployments/provider-deployments.service";

@singleton()
export class ProviderDeploymentsController {
  constructor(private readonly providerDeploymentsService: ProviderDeploymentsService) {}

  async getProviderDeployments(
    provider: string,
    skip: number,
    limit: number,
    status?: ProviderDeploymentsQuery["status"]
  ): Promise<ProviderDeploymentsResponse> {
    const deploymentCountQuery = this.providerDeploymentsService.getProviderDeploymentsCount(provider, status);
    const deploymentsQuery = this.providerDeploymentsService.getProviderDeployments(provider, skip, limit, status);

    const [deploymentCount, deployments] = await Promise.all([deploymentCountQuery, deploymentsQuery]);

    return {
      total: deploymentCount,
      deployments: deployments
    };
  }
}
