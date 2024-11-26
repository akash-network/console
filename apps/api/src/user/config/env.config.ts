import { z } from "zod";

export const envSchema = z.object({
  STALE_ANONYMOUS_USERS_LIVE_IN_DAYS: z.number().optional().default(90)
});
