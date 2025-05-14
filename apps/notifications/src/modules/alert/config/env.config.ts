import { z } from "zod";

export const schema = z.object({
  API_NODE_ENDPOINT: z.string()
});

export type AlertEnvConfig = z.infer<typeof schema>;
