import { z } from "zod";

export const envSchema = z.object({
  AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: z.number({ coerce: true }).optional().default(24),
  AUTO_TOP_UP_AMOUNT_IN_H: z.number({ coerce: true }).optional().default(48),
  PROVIDER_PROXY_URL: z.string().url(),
  GPU_BOT_WALLET_MNEMONIC: z.string().optional()
});

export type DeploymentConfig = z.infer<typeof envSchema>;
