import { z } from "zod";

import { DEFAULT_SEED_VERSION, SEED_VERSION_PATTERN } from "@src/lib/seed-version/seed-version";
import { minSignAndBroadcastDeadlineMs } from "@src/lib/signing-client/signing-client.service";

const KMS_KEY_VERSION_NAME = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/\d+$/;
const KMS_CRYPTO_KEY_NAME = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const WORKLOAD_IDENTITY_AUDIENCE = /^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[^/]+\/providers\/[^/]+$/;

export const envSchema = z
  .object({
    ACCESS_API_KEY: z.string().min(32),
    FUNDING_WALLET_MNEMONIC_V2: z.string(),
    /** Cloud KMS key versions that each hold one more funding wallet, as comma-separated full resource names. */
    FUNDING_WALLET_KMS_KEY_VERSIONS: z
      .string()
      .default("")
      .transform(value =>
        value
          .split(",")
          .map(name => name.trim())
          .filter(Boolean)
      )
      .refine(names => names.every(name => KMS_KEY_VERSION_NAME.test(name)), {
        message: "FUNDING_WALLET_KMS_KEY_VERSIONS must list names like projects/*/locations/*/keyRings/*/cryptoKeys/*/cryptoKeyVersions/1"
      }),
    /** The workload identity pool provider that trusts this pod's Kubernetes identity, which is how the signer reaches Cloud KMS without a stored key. */
    GCP_WORKLOAD_IDENTITY_AUDIENCE: z
      .string()
      .regex(WORKLOAD_IDENTITY_AUDIENCE, {
        message: "GCP_WORKLOAD_IDENTITY_AUDIENCE must look like //iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/*/providers/*"
      })
      .optional(),
    /** Must stay inside a directory the `prod` script allows reading, or the Node permission model denies the read. */
    GCP_WORKLOAD_IDENTITY_TOKEN_FILE: z.string().optional().default("/var/run/secrets/gcp-workload-identity/token"),
    /** Set only when Cloud KMS access is granted to a service account rather than to the workload identity itself. */
    GCP_KMS_SERVICE_ACCOUNT: z.string().email().optional(),
    DERIVATION_WALLET_MNEMONIC_V2: z.string().optional(),
    /** The Cloud KMS key the seeds below were encrypted with; the signer needs no more than decrypt permission on it. */
    DERIVATION_SEED_KMS_KEY: z
      .string()
      .regex(KMS_CRYPTO_KEY_NAME, { message: "DERIVATION_SEED_KMS_KEY must look like projects/*/locations/*/keyRings/*/cryptoKeys/*" })
      .optional(),
    /** Derivation seeds as comma-separated `version:ciphertext` pairs, each ciphertext in base64, so a new seed needs no release. */
    DERIVATION_WALLET_SEEDS_ENCRYPTED: z
      .string()
      .default("")
      .transform(value =>
        value
          .split(",")
          .map(pair => pair.trim())
          .filter(Boolean)
          .map(pair => pair.split(":"))
      )
      .refine(pairs => pairs.every(pair => pair.length === 2 && SEED_VERSION_PATTERN.test(pair[0]) && BASE64.test(pair[1])), {
        message: "DERIVATION_WALLET_SEEDS_ENCRYPTED must list pairs like v3:<base64 ciphertext>"
      })
      .refine(pairs => new Set(pairs.map(([version]) => version)).size === pairs.length, {
        message: "DERIVATION_WALLET_SEEDS_ENCRYPTED must name each seed version once"
      })
      .transform((pairs): Record<string, string> => Object.fromEntries(pairs)),
    /** Signs nothing: only the addresses of first-generation user wallets are read from it, for usage history. */
    DERIVATION_WALLET_MNEMONIC_V1: z.string().optional(),
    RPC_NODE_ENDPOINT: z.string(),
    GRANT_ALLOWED_DENOMS: z
      .string()
      .default("uakt,uact")
      .transform(value =>
        value
          .split(",")
          .map(denom => denom.trim().toLowerCase())
          .filter(Boolean)
      )
      .refine(denoms => denoms.length > 0, { message: "GRANT_ALLOWED_DENOMS must list at least one denom" }),
    GAS_DEFAULT_MULTIPLIER: z.number({ coerce: true }).gt(1).default(2),
    // When a tx still lands out of gas, it is re-signed with gasLimit = on-chain gasUsed × this multiplier and rebroadcast.
    // gasUsed is the actual consumption measured on-chain, so a modest multiplier covers the extra settlement gas that
    // accrues between the failed attempt and the retry's inclusion height.
    GAS_RECOVERY_MULTIPLIER: z.number({ coerce: true }).gt(1).default(1.6),
    AVERAGE_GAS_PRICE: z.number({ coerce: true }).default(0.025),
    // TTL for unordered transactions: the chain keeps the tx hash in memory for this window to reject duplicates,
    // so it must be long enough to guarantee block inclusion but short enough to bound mempool memory.
    UNORDERED_TX_TTL_MS: z.number({ coerce: true }).optional().default(30_000),
    /** Hard ceiling on one sign-and-broadcast, which `apps/api`'s TX_SIGNER_REQUEST_TIMEOUT_MS must stay above. */
    SIGN_AND_BROADCAST_DEADLINE_MS: z.number({ coerce: true }).positive().optional().default(150_000),
    /** Per-RPC-call deadline, without which a black-holed node consumes the whole signing budget on one request. */
    RPC_REQUEST_TIMEOUT_MS: z.number({ coerce: true }).positive().optional().default(10_000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
    STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
    NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
    PORT: z.number({ coerce: true }).optional().default(3091)
  })
  .superRefine((env, ctx) => {
    if (env.FUNDING_WALLET_KMS_KEY_VERSIONS.length > 0 && !env.GCP_WORKLOAD_IDENTITY_AUDIENCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GCP_WORKLOAD_IDENTITY_AUDIENCE is required when FUNDING_WALLET_KMS_KEY_VERSIONS names a key",
        path: ["GCP_WORKLOAD_IDENTITY_AUDIENCE"]
      });
    }

    const encryptedSeedVersions = Object.keys(env.DERIVATION_WALLET_SEEDS_ENCRYPTED);

    if (encryptedSeedVersions.length > 0 && !env.DERIVATION_SEED_KMS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DERIVATION_SEED_KMS_KEY is required when DERIVATION_WALLET_SEEDS_ENCRYPTED holds a seed",
        path: ["DERIVATION_SEED_KMS_KEY"]
      });
    }

    if (encryptedSeedVersions.length > 0 && !env.GCP_WORKLOAD_IDENTITY_AUDIENCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GCP_WORKLOAD_IDENTITY_AUDIENCE is required when DERIVATION_WALLET_SEEDS_ENCRYPTED holds a seed",
        path: ["GCP_WORKLOAD_IDENTITY_AUDIENCE"]
      });
    }

    const readableSeedVersions = [env.DERIVATION_WALLET_MNEMONIC_V1 && "v1", env.DERIVATION_WALLET_MNEMONIC_V2 && "v2"].filter(Boolean);
    const seedVersionGivenTwice = readableSeedVersions.find(version => encryptedSeedVersions.includes(version as string));

    if (seedVersionGivenTwice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Derivation seed ${seedVersionGivenTwice} is given both readable and encrypted, and only one of them can be the seed`,
        path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"]
      });
    }

    if (!readableSeedVersions.includes(DEFAULT_SEED_VERSION) && !encryptedSeedVersions.includes(DEFAULT_SEED_VERSION)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Derivation seed ${DEFAULT_SEED_VERSION} is required, as DERIVATION_WALLET_MNEMONIC_V2 or in DERIVATION_WALLET_SEEDS_ENCRYPTED`,
        path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"]
      });
    }

    if (env.RPC_REQUEST_TIMEOUT_MS >= env.UNORDERED_TX_TTL_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RPC_REQUEST_TIMEOUT_MS must stay below UNORDERED_TX_TTL_MS so one RPC call can still be answered inside the tx window it carries",
        path: ["RPC_REQUEST_TIMEOUT_MS"]
      });
    }

    if (env.SIGN_AND_BROADCAST_DEADLINE_MS < minSignAndBroadcastDeadlineMs(env.UNORDERED_TX_TTL_MS, env.RPC_REQUEST_TIMEOUT_MS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SIGN_AND_BROADCAST_DEADLINE_MS must leave room for a full tx-recovery poll window derived from UNORDERED_TX_TTL_MS",
        path: ["SIGN_AND_BROADCAST_DEADLINE_MS"]
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;
