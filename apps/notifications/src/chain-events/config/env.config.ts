import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  RPC_NODE_ENDPOINT: z.string(),
});

export type ChainEventsEnvConfig = z.infer<typeof schema>;

export default registerAs('chain-events', () => schema.parse(process.env));
