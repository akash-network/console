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
     * How long a deployment settings row is left alone before the orphan cleanup will look at it. It only has to
     * outlast the gap between writing the record and the create tx reaching the chain — the signer round trip
     * plus one block — so an hour is two orders of magnitude of headroom. Raising it only delays a deletion;
     * lowering it below that gap would let the cleanup race a create that is still in flight.
     */
    ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_GRACE_IN_H: z.number({ coerce: true }).positive().finite().optional().default(1),
    /**
     * How many deployment settings rows the orphan cleanup reads per query. A page size, not a coverage limit:
     * the cleanup keeps paging until the candidates run out, so this bounds the size of one read and nothing
     * else. It must not become a cap on how much history a run covers — records the cleanup never examines
     * are the oldest of their cohort and would sit permanently below a moving waterline, which would make
     * the cleanup worst exactly during the outage that mass-produces the orphans it exists to remove.
     */
    ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_PAGE_SIZE: z.number({ coerce: true }).int().positive().finite().optional().default(500),
    /**
     * How long the orphan cleanup keeps paging before it stops and reports what it did not reach. This, not a
     * record count, is what bounds a run: the cleanup is idempotent and pages newest first, so a run that
     * spends its budget has deleted the recent records and left the rest for the next one. Keep it under the
     * job's `activeDeadlineSeconds` so the cleanup ends itself and logs, rather than being killed mid-page.
     */
    ORPHANED_DEPLOYMENT_SETTINGS_CLEANUP_BUDGET_IN_MIN: z.number({ coerce: true }).positive().finite().optional().default(20),
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
