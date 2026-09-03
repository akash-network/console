import { z } from "zod";

import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";
import {
  CREATE_DEPLOYMENT_BODY_LIMIT_BYTES,
  maxSealedSecretsBytes,
  SDL_SECRETS_DEFAULT_MAX_COUNT,
  SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES
} from "@src/deployment/config/sdl-secrets.config";
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
    /** Must outlast a create still in flight: this delay, not the cancellation, is what keeps a live deployment's row safe. */
    UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: z.number({ coerce: true }).min(15).finite().optional().default(60),
    /** Retries pg-boss adds on top of the first attempt, sized to outlast a chain-node outage since nothing can find a row that exhausts them. */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: z.number({ coerce: true }).int().positive().optional().default(47),
    /** pg-boss multiplies its backoff by this and defaults it to 0, which would collapse every later gap to zero. */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: z.number({ coerce: true }).int().positive().optional().default(30),
    /** Reaches pg-boss as seconds in an integer column, so a value that is not whole seconds makes every enqueue throw. */
    UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: z
      .number({ coerce: true })
      .positive()
      .finite()
      .refine(value => Number.isInteger(value * 60), "must convert to a whole number of seconds, since the backoff ceiling is stored in seconds")
      .optional()
      .default(30),
    /**
     * Keeps the expired-deployment close job from broadcasting: it logs the close it would have made and
     * reschedules itself instead. Defaults to on so an environment that has not opted into closing keeps
     * observing, and closing for real is one variable away.
     */
    CLOSE_EXPIRED_DEPLOYMENTS_DRY_RUN: z.enum(["true", "false"]).default("true"),
    /** How long before a runtime-limited deployment reaches its limit the user is warned by email. */
    RUNTIME_LIMIT_WARNING_LEAD_IN_H: z.number({ coerce: true }).positive().finite().optional().default(6),
    /**
     * Shortest runtime limit worth warning about. A limit only a little wider than the lead time would be
     * warned about almost as soon as it is set, which tells the user nothing they did not just decide.
     */
    RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H: z.number({ coerce: true }).positive().finite().optional().default(12),
    /** Long enough that a provider working through an outage is not announced as dead to the owners running on it. */
    PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS: z.number({ coerce: true }).positive().finite().optional().default(3),
    /** Must stay above the warning threshold so an owner is always told before anything of theirs is closed. */
    PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS: z.number({ coerce: true }).positive().finite().optional().default(14),
    /** An outage the inventory has not re-checked within this window describes the past, not the present, so the sweeps refuse it. */
    PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H: z.number({ coerce: true }).positive().finite().optional().default(3),
    /** Base URL of the provider inventory service, which owns the record of who is currently unreachable. */
    PROVIDER_INVENTORY_API_URL: z.string().url(),
    /** Base URL of the web console, used to deep-link emails at a deployment or account page. */
    DEPLOY_WEB_BASE_URL: z.string().url(),
    PROVIDER_PROXY_URL: z.string().url(),
    GPU_BOT_WALLET_MNEMONIC: z.string().optional(),
    /** Secrets one deployment may carry. Raising it past what the create route's body limit was sized for is refused below rather than at request time. */
    SDL_SECRETS_MAX_COUNT: z.number({ coerce: true }).int().positive().optional().default(SDL_SECRETS_DEFAULT_MAX_COUNT),
    /** Bytes one secret value may be, measured as UTF-8 rather than as string length, since it is a storage bound and a character is not a byte. */
    SDL_SECRETS_MAX_VALUE_BYTES: z.number({ coerce: true }).int().positive().optional().default(SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES),
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

    if (env.PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS <= env.PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS"],
        message: `PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS (${env.PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS}) must be greater than PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS (${env.PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS}), otherwise a deployment can be closed before its owner has been warned`
      });
    }

    const sealHeadroom = CREATE_DEPLOYMENT_BODY_LIMIT_BYTES - DEFAULT_BODY_LIMIT_BYTES;
    const sealedSecretsBytes = maxSealedSecretsBytes({ maxCount: env.SDL_SECRETS_MAX_COUNT, maxValueBytes: env.SDL_SECRETS_MAX_VALUE_BYTES });

    if (sealedSecretsBytes > sealHeadroom) {
      const message = `SDL_SECRETS_MAX_COUNT (${env.SDL_SECRETS_MAX_COUNT}) and SDL_SECRETS_MAX_VALUE_BYTES (${env.SDL_SECRETS_MAX_VALUE_BYTES}) can produce a seal of ${sealedSecretsBytes} bytes, above the ${sealHeadroom} bytes the create route's body limit was sized for, so a request at these limits would be refused before the limits could be applied`;

      for (const path of ["SDL_SECRETS_MAX_COUNT", "SDL_SECRETS_MAX_VALUE_BYTES"]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      }
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
