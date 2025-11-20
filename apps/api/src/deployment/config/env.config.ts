import { z } from "zod";

export const envSchema = z.object({
  AUTO_TOP_UP_JOB_INTERVAL_IN_H: z.number({ coerce: true }).optional().default(1),
  AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H: z.number({ coerce: true }).optional().default(3),
  PROVIDER_PROXY_URL: z.string().url(),
  GPU_BOT_WALLET_MNEMONIC: z.string().optional()
});

export type DeploymentConfig = z.infer<typeof envSchema>;
