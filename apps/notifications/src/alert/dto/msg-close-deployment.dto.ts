import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MsgCloseDeploymentSchema = z.object({
  type: z.literal('akash.deployment.v1beta3.MsgCloseDeployment'),
  value: z.object({
    id: z.object({
      dseq: z.object({
        low: z.number(),
      }),
      owner: z.string(),
    }),
    $type: z.literal('akash.deployment.v1beta3.MsgCloseDeployment'),
  }),
});

export class MsgCloseDeploymentDto extends createZodDto(
  MsgCloseDeploymentSchema,
) {}
