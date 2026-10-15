import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put, UsePipes } from "@nestjs/common";
import { ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { createZodDto, ZodValidationPipe } from "nestjs-zod";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";

const deploymentAlertsProjectSchema = z.object({
  data: z.object({
    owner: z.string().min(1),
    projectId: z.string().uuid()
  })
});

export class DeploymentAlertsProjectInput extends createZodDto(deploymentAlertsProjectSchema) {}

@ApiTags("Internal/DeploymentAlert")
@Controller({ path: "internal/v1/organizations/:organizationId/deployment-alerts" })
@Unprotected()
export class InternalDeploymentAlertController {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(InternalDeploymentAlertController.name);
  }

  @Put(":dseq/project")
  @HttpCode(204)
  @UsePipes(ZodValidationPipe)
  @ApiNoContentResponse({ description: "Files the alerts of a deployment into the project the deployment moved to" })
  async moveDeploymentAlertsToProject(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("dseq") dseq: string,
    @Body() { data: { owner, projectId } }: DeploymentAlertsProjectInput
  ): Promise<void> {
    const alertsMoved = await this.alertRepository.moveDeploymentAlertsToProject({ organizationId, deployment: { owner, dseq }, projectId });

    this.loggerService.log({ event: "DEPLOYMENT_ALERTS_MOVED_TO_PROJECT", organizationId, owner, dseq, projectId, alertsMoved });
  }
}
