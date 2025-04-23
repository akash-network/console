import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  BLOCK_TIME_SEC: z.number({ coerce: true }).optional().default(6000),
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;
export default registerAs('chain-events', () => schema.parse(process.env));
