import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  GetDeploymentLocationResponse,
  UpdateDeploymentProjectRequest,
  UpdateDeploymentProjectResponse
} from "@src/deployment/http-schemas/deployment-project.schema";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";

@singleton()
export class DeploymentProjectController {
  constructor(private readonly deploymentProjectService: DeploymentProjectService) {}

  @Protected()
  async move(dseq: string, input: UpdateDeploymentProjectRequest["data"]): Promise<UpdateDeploymentProjectResponse> {
    return { data: await this.deploymentProjectService.move(dseq, input.projectId) };
  }

  @Protected()
  async findLocation(dseq: string): Promise<GetDeploymentLocationResponse> {
    return { data: await this.deploymentProjectService.findLocation(dseq) };
  }
}
