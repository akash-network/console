import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { Ok, Result } from "ts-results";
import { z } from "zod";

import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";

const deploymentBalanceAlertInput = z.object({
  contactPointId: z.string().uuid(),
  enabled: z.boolean().optional().default(true),
  threshold: z.number().min(0)
});

const deploymentClosedAlertInput = z.object({
  contactPointId: z.string().uuid(),
  enabled: z.boolean().optional().default(true)
});

const deploymentAlertCreateSchema = z.object({
  data: z.object({
    owner: z.string(),
    alerts: z.object({
      deploymentBalance: deploymentBalanceAlertInput.optional(),
      deploymentClosed: deploymentClosedAlertInput.optional()
    })
  })
});

export class DeploymentAlertCreateInput extends createZodDto(deploymentAlertCreateSchema) {}

const baseAlertOutputSchema = z.object({
  id: z.string().uuid(),
  status: z.string()
});

const deploymentBalanceAlertOutputSchema = deploymentBalanceAlertInput.merge(baseAlertOutputSchema);
const deploymentClosedAlertOutputSchema = deploymentClosedAlertInput.merge(baseAlertOutputSchema);

const deploymentAlertsOutputSchema = z.object({
  dseq: z.string(),
  owner: z.string().optional(),
  alerts: z.object({
    deploymentBalance: deploymentBalanceAlertOutputSchema.optional(),
    deploymentClosed: deploymentClosedAlertOutputSchema.optional()
  })
});

const deploymentAlertsResponseSchema = z.object({
  data: deploymentAlertsOutputSchema
});

export class DeploymentAlertsResponse extends createZodDto(deploymentAlertsResponseSchema) {}

@Controller({
  version: "1",
  path: "deployment-alerts"
})
export class DeploymentAlertController {
  constructor(
    private readonly deploymentAlertService: DeploymentAlertService,
    private readonly authService: AuthService
  ) {}

  @Post(":dseq")
  @ValidateHttp({
    201: { schema: DeploymentAlertsResponse, description: "Returns the created alert" }
  })
  async upsertDeploymentAlert(@Param("dseq") dseq: string, @Body() { data }: DeploymentAlertCreateInput): Promise<Result<DeploymentAlertsResponse, unknown>> {
    return Ok({
      data: await this.deploymentAlertService.upsert(
        {
          ...data,
          dseq
        },
        this.authService
      )
    });
  }

  @Get(":dseq")
  @ValidateHttp({
    200: { schema: DeploymentAlertsResponse, description: "Returns alerts for the specified deployment" }
  })
  async getDeploymentAlerts(@Param("dseq") dseq: string): Promise<Result<DeploymentAlertsResponse, unknown>> {
    return Ok({
      data: await this.deploymentAlertService.get(dseq, this.authService.ability)
    });
  }
}
