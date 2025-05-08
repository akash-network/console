import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';

import { ValidateHttp } from '@src/interfaces/rest/interceptors/http-validate/http-validate.interceptor';
import {
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

export const alertCreateOutputSchema = alertCreateInputSchema.extend({
  id: z.string().uuid(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

@Controller({
  version: '1',
  path: 'alerts',
})
export class AlertController {
  constructor(private readonly rawAlertRepository: RawAlertRepository) {}

  @Post('raw')
  @ValidateHttp({
    body: z.object({ data: alertCreateInputSchema }),
    response: z.object({ data: alertCreateOutputSchema }),
  })
  async createAlert(
    @Body() { data }: { data: z.infer<typeof alertCreateInputSchema> },
  ): Promise<{ data: z.infer<typeof alertCreateOutputSchema> }> {
    return {
      data: await this.rawAlertRepository.create(data),
    };
  }
}
