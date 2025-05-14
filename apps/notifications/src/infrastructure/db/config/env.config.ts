import { z } from "zod";

export const schema = z.object({
  NOTIFICATIONS_POSTGRES_URL: z.string()
});

export type DbEnvConfig = z.infer<typeof schema>;
