import { z } from "zod";

const envSchema = z.object({
  AUTO_TOP_UP_JOB_INTERVAL_IN_H: z.number({ coerce: true }).optional().default(1),
  AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_DAYS: z.number({ coerce: true }).optional().default(7)
});

export const envConfig = envSchema.parse(process.env);
