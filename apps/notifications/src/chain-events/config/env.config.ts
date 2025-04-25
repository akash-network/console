import { z } from 'zod';

const schema = z.object({
  BLOCK_TIME_SEC: z.number({ coerce: true }).optional().default(6),
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;
export const envConfig = schema.parse(process.env);
