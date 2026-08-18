import { z } from "zod";

import { denomToUdenom } from "@src/utils/math";

export const envSchema = z.object({
  AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: z.number({ coerce: true }).optional().default(24),
  AUTO_TOP_UP_AMOUNT_IN_H: z.number({ coerce: true }).optional().default(48),
  AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN: z.number({ coerce: true }).positive().optional().default(60),
  /**
   * Deposit (in whole tokens) the platform bootstraps a managed deployment with when the caller no longer supplies one.
   * Must stay at or above the chain's `min_deposits` for the active `DEPLOYMENT_GRANT_DENOM`, or the create tx is rejected
   * on-chain. Kept minimal on purpose: auto-funding tops the deployment up to its runway right after the lease starts.
   */
  DEPLOYMENT_DEFAULT_DEPOSIT: z
    .number({ coerce: true })
    .refine(value => Number.isFinite(value) && denomToUdenom(value) > 0, "must be a finite amount that converts to a positive on-chain deposit")
    .optional()
    .default(0.5),
  PROVIDER_PROXY_URL: z.string().url(),
  GPU_BOT_WALLET_MNEMONIC: z.string().optional()
});

export type DeploymentConfig = z.infer<typeof envSchema>;
