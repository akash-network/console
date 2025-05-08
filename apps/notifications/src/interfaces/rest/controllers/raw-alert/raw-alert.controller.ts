import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Err, Ok, Result } from 'ts-results';
import { z } from 'zod';

import { ValidateHttp } from '@src/interfaces/rest/interceptors/http-validate/http-validate.interceptor';
import {
  AlertOutput,
  conditionSchema as rawConditionSchema,
  RawAlertRepository,
} from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';

export const alertCreateInputSchema = z.object({
  // TODO: receive user from the auth instead
  userId: z.string().uuid(),
  contactPointId: z.string().uuid(),
  enabled: z.boolean().optional().default(true),
  summary: z.string().min(3),
  description: z.string().min(3),
  conditions: rawConditionSchema,
});

export const alertOutputSchema = alertCreateInputSchema.extend({
  id: z.string().uuid(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const alertOutputResponseSchema = z.object({ data: alertOutputSchema });
export type AlertOutputResponse = z.infer<typeof alertOutputResponseSchema>;

export const alertPatchInputSchema = z.object({
  contactPointId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
  summary: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  conditions: rawConditionSchema.optional(),
});

export const alertNotFoundError = new NotFoundException('Alert not found');

@Controller({
  version: '1',
  path: 'alerts',
})
export class RawAlertController {
  constructor(private readonly rawAlertRepository: RawAlertRepository) {}

  @Post('raw')
  @ValidateHttp({
    body: z.object({ data: alertCreateInputSchema }),
    response: alertOutputResponseSchema,
  })
  async createAlert(
    @Body() { data }: { data: z.infer<typeof alertCreateInputSchema> },
  ): Promise<Result<AlertOutputResponse, unknown>> {
    return Ok({
      data: await this.rawAlertRepository.create(data),
    });
  }

  @Get('raw/:id')
  @ValidateHttp({
    response: alertOutputResponseSchema,
  })
  async getAlert(
    @Param('id') id: string,
  ): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.rawAlertRepository.findOneById(id);
    return this.toResponse(alert);
  }

  @Patch('raw/:id')
  @ValidateHttp({
    body: z.object({ data: alertPatchInputSchema }),
    response: alertOutputResponseSchema,
  })
  async patchAlert(
    @Param('id') id: string,
    @Body() { data }: { data: z.infer<typeof alertPatchInputSchema> },
  ): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.rawAlertRepository.updateById(id, data);
    return this.toResponse(alert);
  }

  @Delete('raw/:id')
  @ValidateHttp({
    response: alertOutputResponseSchema,
  })
  async deleteAlert(
    @Param('id') id: string,
  ): Promise<Result<AlertOutputResponse, NotFoundException>> {
    const alert = await this.rawAlertRepository.deleteOneById(id);
    return this.toResponse(alert);
  }

  private toResponse(
    alert: AlertOutput | undefined,
  ): Result<AlertOutputResponse, NotFoundException> {
    return alert ? Ok({ data: alert }) : Err(alertNotFoundError);
  }
}
