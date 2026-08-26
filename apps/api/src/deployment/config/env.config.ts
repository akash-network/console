import { z } from "zod";

import { denomToUdenom } from "@src/utils/math";

/**
 * Points the client at a plaintext-gRPC emulator instead of Google's endpoint, which is how
 * local development runs. `servicePath` is an addition to the JSON key file shape Google issues.
 */
const gcpKmsEmulatorAuthSchema = z.object({
  project_id: z.string(),
  servicePath: z.string().url()
});

/** Service account material for Cloud KMS, as the JSON key file Google issues. */
const gcpKmsServiceAccountAuthSchema = z.object({
  project_id: z.string(),
  client_email: z.string().email(),
  private_key: z.string(),
  servicePath: z.undefined()
});

const gcpKmsAuthSchema = z.union([gcpKmsEmulatorAuthSchema, gcpKmsServiceAccountAuthSchema]);

const jsonEnv = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .min(1)
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be valid JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);

export const envSchema = z
  .object({
    AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: z.number({ coerce: true }).nonnegative().finite().optional().default(24),
    /**
     * Hours of runway automatic funding brings a deployment up to, counting the runway it already holds.
     * Must stay above `AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H`: funding only triggers once a deployment drops
     * inside that window, so the gap between the two is the smallest deposit a triggering deployment can
     * receive. At or below the window that floor is zero, so a deployment triggering at the edge of the
     * window is funded nothing and simply re-triggers, hence the schema check below.
     */
    AUTO_TOP_UP_TARGET_RUNWAY_IN_H: z.number({ coerce: true }).positive().finite().optional().default(48),
    AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN: z.number({ coerce: true }).positive().optional().default(60),
    /**
     * Dollar floor auto-funding leaves in the available deployment allowance so a user with credits left can still
     * create a deployment. Whole dollars: `DEPLOYMENT_GRANT_DENOM` is `uact` on real networks, 1:1 with USD.
     * 0 restores the previous drain-to-zero behavior.
     */
    AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: z.number({ coerce: true }).nonnegative().finite().optional().default(5),
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
    /**
     * How long a newly recorded deployment setting is left alone before the console asks the chain whether the
     * create it was written for ever landed.
     *
     * This is the real invariant protecting a live deployment's row, not the cancellation on a successful
     * broadcast: `cancelCreatedBy` only cancels a job still in state `created`, so a compensation a worker has
     * already picked up cannot be called off at all, and the delay is the only thing that keeps it from being
     * picked up while the create is still in flight. Check too early and the chain has nothing to report yet.
     *
     * Waiting longer only ever delays deleting a row nothing reads, so the default is orders of magnitude above
     * the worst case of broadcasting a create and having it indexed. The floor exists because a value near zero
     * would turn the compensation into "delete every create whose tx is not yet on chain"; the presence check
     * enforces its own margin on top, so a short value here costs retries rather than rows.
     */
    UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: z.number({ coerce: true }).min(15).finite().optional().default(60),
    /**
     * How long the console keeps re-asking the chain about a deployment setting whose create may never have landed.
     * Nothing else can find such a row, so a compensation that exhausts its retries leaks it permanently; the horizon
     * is therefore sized to outlast a chain-node outage rather than a blip. With the backoff below doubling from
     * 30s and capped at half an hour, 48 attempts span about 21.5 to 22 hours depending on jitter.
     */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(48),
    /**
     * First gap between chain re-checks, doubling from there. pg-boss multiplies its backoff by this value and
     * defaults it to 0, which collapses every later gap to zero however high the cap is set — so it must be
     * positive for the horizon below to exist at all.
     */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: z.number({ coerce: true }).int().positive().optional().default(30),
    /** Ceiling on the exponential backoff between chain re-checks, so a long outage is retried steadily rather than ever more rarely. */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: z.number({ coerce: true }).positive().finite().optional().default(30),
    /** How long before a runtime-limited deployment reaches its limit the user is warned by email. */
    RUNTIME_LIMIT_WARNING_LEAD_IN_H: z.number({ coerce: true }).positive().finite().optional().default(6),
    /**
     * Shortest runtime limit worth warning about. A limit only a little wider than the lead time would be
     * warned about almost as soon as it is set, which tells the user nothing they did not just decide.
     */
    RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H: z.number({ coerce: true }).positive().finite().optional().default(12),
    /** Base URL of the web console, used to deep-link emails at a deployment or account page. */
    DEPLOY_WEB_BASE_URL: z.string().url(),
    PROVIDER_PROXY_URL: z.string().url(),
    GPU_BOT_WALLET_MNEMONIC: z.string().optional(),
    GCP_KMS_AUTH: jsonEnv(gcpKmsAuthSchema),
    GCP_KMS_LOCATION: z.string().optional().default("global"),
    GCP_KMS_KEY_RING: z.string().optional().default("console-api"),
    GCP_KMS_KEY: z.string().optional().default("sdl-secrets"),
    GCP_KMS_KEY_VERSION: z.string().optional().default("1")
  })
  .superRefine((env, ctx) => {
    if (env.RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H < 2 * env.RUNTIME_LIMIT_WARNING_LEAD_IN_H) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H"],
        message: `RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H (${env.RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H}) must be at least twice RUNTIME_LIMIT_WARNING_LEAD_IN_H (${env.RUNTIME_LIMIT_WARNING_LEAD_IN_H}), otherwise the shortest warned limit is warned about almost as soon as it is set`
      });
    }

    if (env.AUTO_TOP_UP_TARGET_RUNWAY_IN_H <= env.AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTO_TOP_UP_TARGET_RUNWAY_IN_H"],
        message: `AUTO_TOP_UP_TARGET_RUNWAY_IN_H (${env.AUTO_TOP_UP_TARGET_RUNWAY_IN_H}) must be greater than AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H (${env.AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H}), otherwise a deployment triggering at the edge of the window is sized a zero deposit`
      });
    }
  });

export type GcpKmsAuth = z.infer<typeof gcpKmsAuthSchema>;
export type DeploymentConfig = z.infer<typeof envSchema>;
