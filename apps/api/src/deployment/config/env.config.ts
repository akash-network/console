import { z } from "zod";

import { denomToUdenom } from "@src/utils/math";

export const envSchema = z
  .object({
    AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: z.number({ coerce: true }).nonnegative().finite().optional().default(24),
    /**
     * Hours of runway automatic funding brings a deployment up to, counting the runway it already holds.
     * Must stay above `AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H`: funding only triggers once a deployment drops
     * inside that window, so the gap between the two is what a single deposit covers. At or below it every
     * deposit sizes to zero and automatic funding stops entirely, hence the schema check below.
     */
    AUTO_TOP_UP_TARGET_RUNWAY_IN_H: z.number({ coerce: true }).positive().finite().optional().default(48),
    AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN: z.number({ coerce: true }).positive().optional().default(60),
    /**
     * Dollar floor auto-funding leaves in the available deployment allowance so a user with credits left can still
     * create a deployment. Whole dollars: `DEPLOYMENT_GRANT_DENOM` is `uact` on real networks, 1:1 with USD.
     * 0 restores the previous drain-to-zero behavior.
     */
    AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: z.number({ coerce: true }).nonnegative().optional().default(5),
    /**
     * Deposit (in dollars) the platform bootstraps a managed deployment with when the caller no longer supplies one.
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
  })
  .superRefine((env, ctx) => {
    if (env.AUTO_TOP_UP_TARGET_RUNWAY_IN_H <= env.AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTO_TOP_UP_TARGET_RUNWAY_IN_H"],
        message: `AUTO_TOP_UP_TARGET_RUNWAY_IN_H (${env.AUTO_TOP_UP_TARGET_RUNWAY_IN_H}) must be greater than AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H (${env.AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H}), otherwise automatic funding sizes every deposit to zero`
      });
    }
  });

export type DeploymentConfig = z.infer<typeof envSchema>;
