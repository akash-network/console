import { Body, Controller, Get, Headers, NotFoundException, Param, Post } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { Ok, Result } from "ts-results";
import { z } from "zod";

import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

const deploymentBalanceAlertInput = z.object({
  notificationChannelId: z.string().uuid(),
  enabled: z.boolean().optional().default(true),
  threshold: z.number().min(0)
});

const deploymentClosedAlertInput = z.object({
  notificationChannelId: z.string().uuid(),
  enabled: z.boolean().optional().default(true)
});

const deploymentAlertCreateSchema = z.object({
  data: z.object({
    alerts: z.object({
      deploymentBalance: deploymentBalanceAlertInput.optional(),
      deploymentClosed: deploymentClosedAlertInput.optional()
    })
  })
});

export class DeploymentAlertCreateInput extends createZodDto(deploymentAlertCreateSchema) {}

const baseAlertOutputSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  suppressedBySystem: z.boolean().optional()
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
    private readonly notificationChannelRepository: NotificationChannelRepository,
    private readonly authService: AuthService
  ) {}

  @Post(":dseq")
  @ValidateHttp({
    201: { schema: DeploymentAlertsResponse, description: "Returns the created alert" }
  })
  @ApiHeader({
    name: "x-owner-address",
    required: false,
    description: "The address of the user who owns the deployment"
  })
  async upsertDeploymentAlert(
    @Param("dseq") dseq: string,
    @Body() { data }: DeploymentAlertCreateInput,
    @Headers("x-owner-address") owner?: string
  ): Promise<Result<DeploymentAlertsResponse, unknown>> {
    await this.assertAttachableNotificationChannels(data);

    const result = await this.deploymentAlertService.upsert(
      {
        ...data,
        owner,
        dseq
      },
      this.authService
    );

    return result.ok
      ? Ok({
          data: result.val
        })
      : result;
  }

  @Get(":dseq")
  @ValidateHttp({
    200: { schema: DeploymentAlertsResponse, description: "Returns alerts for the specified deployment" }
  })
  async listDeploymentAlerts(@Param("dseq") dseq: string): Promise<Result<DeploymentAlertsResponse, unknown>> {
    return Ok({
      data: await this.deploymentAlertService.get(dseq, this.authService.ability)
    });
  }

  private async assertAttachableNotificationChannels({ alerts }: DeploymentAlertCreateInput["data"]): Promise<void> {
    const notificationChannelRepository = this.notificationChannelRepository.accessibleBy(this.authService.ability, "read");
    const channelIds = new Set(
      [alerts.deploymentBalance?.notificationChannelId, alerts.deploymentClosed?.notificationChannelId].filter(id => id !== undefined)
    );

    for (const channelId of channelIds) {
      if (!(await notificationChannelRepository.findAttachableById(channelId, this.authService.organizationId))) {
        throw new NotFoundException("Notification channel not found");
      }
    }
  }
}
