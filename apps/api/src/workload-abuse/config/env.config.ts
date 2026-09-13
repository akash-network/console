import { z } from "zod";

const signaturePatternSchema = z.object({
  category: z.string().min(1),
  pattern: z.string().min(1),
  flags: z
    .string()
    .regex(/^[imsu]*$/)
    .optional()
});

const signatureGroupsSchema = z.object({
  hard: z.array(signaturePatternSchema).default([]),
  soft: z.array(signaturePatternSchema).default([]),
  proxy: z.array(signaturePatternSchema).default([])
});

export const SIGNATURE_BUCKETS = ["hard", "soft", "proxy"] as const;
export type SignatureBucket = (typeof SIGNATURE_BUCKETS)[number];
export type CompiledSignature = { bucket: SignatureBucket; category: string; pattern: RegExp };

/** The list itself lives in Doppler, so a reader of this open-source code learns how matching works but not what is matched. */
export function compileSignatures(raw: string, ctx: z.RefinementCtx): CompiledSignature[] {
  const groups = signatureGroupsSchema.safeParse(parseJson(raw));

  if (!groups.success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `WORKLOAD_ABUSE_SIGNATURES is not a valid signature document: ${groups.error.message}` });
    return z.NEVER;
  }

  const compiled: CompiledSignature[] = [];

  for (const bucket of SIGNATURE_BUCKETS) {
    for (const { category, pattern, flags } of groups.data[bucket]) {
      try {
        compiled.push({ bucket, category, pattern: new RegExp(pattern, flags ?? "i") });
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `WORKLOAD_ABUSE_SIGNATURES has an invalid pattern for ${bucket}/${category}` });
        return z.NEVER;
      }
    }
  }

  return compiled;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const DEFAULT_PROBE_INITIAL_DELAYS_MIN = "5,20,60";

function parseMinutesList(raw: string, ctx: z.RefinementCtx): number[] {
  const entries = raw.split(",").map(entry => entry.trim());

  if (entries.some(entry => !/^\d+$/.test(entry))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a comma-separated list of non-negative integers" });
    return z.NEVER;
  }

  return entries.map(Number);
}

function blankToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const envSchema = z.object({
  WORKLOAD_ABUSE_PROBE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform(value => value === "true"),
  WORKLOAD_ABUSE_SIGNATURES: z.string().default("{}").transform(compileSignatures),
  /** `detect` records hard verdicts without acting on them, so a rollout can be compared against manual review first. */
  WORKLOAD_ABUSE_ENFORCEMENT_MODE: z.enum(["detect", "enforce"]).default("detect"),
  WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: z.preprocess(blankToUndefined, z.string().default(DEFAULT_PROBE_INITIAL_DELAYS_MIN).transform(parseMinutesList)),
  WORKLOAD_ABUSE_PROBE_INTERVAL_MIN: z.number({ coerce: true }).int().positive().default(60),
  WORKLOAD_ABUSE_PROBE_JITTER_MIN: z.number({ coerce: true }).int().nonnegative().default(10),
  /** Trial deployments close after a day on their own, so this only bounds a deployment that close missed. */
  WORKLOAD_ABUSE_PROBE_MAX_PER_DEPLOYMENT: z.number({ coerce: true }).int().positive().default(30),
  WORKLOAD_ABUSE_PROBE_LOG_TAIL: z.number({ coerce: true }).int().positive().default(300),
  WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS: z.number({ coerce: true }).int().positive().default(5_000),
  WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS: z.number({ coerce: true }).int().positive().default(30_000),
  WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES: z.number({ coerce: true }).int().positive().default(65_536),
  /** Long enough for a shell round trip through the proxy, short enough that a leaked token is worthless minutes later. */
  WORKLOAD_ABUSE_PROVIDER_JWT_TTL_SECONDS: z.number({ coerce: true }).int().positive().default(120),
  /** How far back the reconcile sweep looks for live trial deployments without a pending probe. */
  WORKLOAD_ABUSE_RECONCILE_MAX_AGE_HOURS: z.number({ coerce: true }).int().positive().default(26),
  /** `detect` runs every guardrail and records the verdict without writing a block or wiping a sibling. */
  WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE: z.enum(["detect", "enforce"]).default("detect"),
  /** The admin console writes the table out of band, so an operator un-blocking a domain waits at most this long. */
  WORKLOAD_ABUSE_BLOCKED_DOMAIN_CACHE_TTL_SECONDS: z.number({ coerce: true }).int().positive().default(60),
  /** Bounds the damage of a domain match that turns out to be too broad. */
  WORKLOAD_ABUSE_DOMAIN_BLOCK_MAX_SIBLINGS: z.number({ coerce: true }).int().positive().default(200),
  /** A domain with an account older than this predates the attack, so it is somebody's real domain. */
  WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS: z.number({ coerce: true }).int().positive().default(30)
});

export type WorkloadAbuseConfig = z.infer<typeof envSchema>;
