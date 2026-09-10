import type { SDLInput } from "@akashnetwork/chain-sdk";
import { DeploymentInfoSchema } from "@akashnetwork/http-sdk";
import { z } from "zod";

import { SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { MAX_MANIFEST_VERSION_LENGTH, MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/deployment/utils/deployment-name/deployment-name";
import { openApiExampleAddress } from "@src/utils/constants";
import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";
import { LeaseStatusResponseSchema } from "./lease.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "./runtime-limit";

const DeploymentLeaseSchema = z.object({
  id: z.object({
    owner: z.string(),
    dseq: DseqSchema,
    gseq: z.number(),
    oseq: z.number(),
    provider: z.string(),
    bseq: z.number()
  }),
  state: z.string(),
  price: z.object({
    denom: z.string(),
    amount: z.string()
  }),
  created_at: z.string(),
  closed_on: z.string(),
  reason: z.string().optional(),
  status: z.nullable(LeaseStatusResponseSchema)
});

export const DeploymentResponseSchema = z.object({
  deployment: z.object({
    id: z.object({
      owner: z.string(),
      dseq: DseqSchema
    }),
    state: z.string(),
    hash: z.string(),
    created_at: z.string()
  }),
  leases: z.array(DeploymentLeaseSchema),
  escrow_account: z.object({
    id: z.object({
      scope: z.string(),
      xid: z.string()
    }),
    state: z.object({
      owner: z.string(),
      state: z.string(),
      transferred: z.array(
        z.object({
          denom: z.string(),
          amount: z.string()
        })
      ),
      settled_at: z.string(),
      funds: z.array(
        z.object({
          denom: z.string(),
          amount: z.string()
        })
      ),
      deposits: z.array(
        z.object({
          owner: z.string(),
          height: z.string(),
          source: z.string(),
          balance: z.object({
            denom: z.string(),
            amount: z.string()
          })
        })
      )
    })
  })
});

const DeploymentLeaseListItemSchema = DeploymentResponseSchema.extend({
  leases: z.array(DeploymentLeaseSchema.omit({ status: true }))
});

const ConsoleSettingsSchema = z.object({
  sdl: z.string().openapi({
    description: "The SDL the console stored for this deployment. Re-serialized YAML, so not byte-identical to the submitted document."
  }),
  manifestVersion: z.string().openapi({
    description: "Base64 of the manifest version this deployment commits on chain. Deliberately not a hash of the `sdl` above."
  })
});

export const GetDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema.extend({
    consoleSettings: ConsoleSettingsSchema.nullable().openapi({
      description: "What the console recorded for this deployment, or null when it recorded nothing."
    })
  })
});

/** POST /v1/leases answers with the deployment as the chain describes it, without the console's own record. */
export const CreateLeaseResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const GetDeploymentParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

/** Every reader treats an empty seal as no seal, so accepting one would take a request the caller meant as a secret write and silently do nothing. */
const SealedSecretsSchema = z.string().min(1);

/** Trimmed before it is measured, so a name of nothing but spaces is refused rather than stored as a blank one. */
const DeploymentNameSchema = z.string().trim().min(1).max(MAX_DEPLOYMENT_NAME_LENGTH);

export const CreateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string().max(MAX_SUBMITTED_SDL_LENGTH),
    name: DeploymentNameSchema.optional().openapi({
      description:
        "Name for this deployment, shown wherever it is listed. Omit it and the console names the deployment after the services the SDL declares, joined with `+`."
    }),
    sealedSecrets: SealedSecretsSchema.optional().openapi({
      description:
        "Compact JWE sealing a flat name-to-value map of the secrets this SDL references, encrypted to the console's public sealing key. Fetch that key and the claims to sign from GET /v1/sdl-secrets-context. Values are never returned by any endpoint once sealed."
    }),
    inheritSecretsFrom: DseqSchema.optional().openapi({
      description:
        "Dseq of one of your own deployments whose stored secrets this deployment starts from, for redeploying an SDL without re-entering its values. The source may be closed. A name also present in `sealedSecrets` takes precedence over the inherited one."
    }),
    deposit: z.number().optional().openapi({
      deprecated: true,
      description: "Deprecated and ignored. The platform funds every deployment automatically from your account credits."
    }),
    runtimeLimitHours: z
      .number()
      .int()
      .min(1)
      .max(MAX_RUNTIME_LIMIT_INCREMENT_HOURS)
      .optional()
      .openapi({
        description: `Optional runtime limit in hours (1 to ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS}), counted from lease start. Automatic funding keeps the deployment running until the limit, then the deployment is closed automatically and unused funds are returned. Extend a limit with PATCH /v2/deployment-settings/{dseq}. Omit for always-on funding.`
      })
  })
});

export const CreateDeploymentResponseSchema = z.object({
  data: z.object({
    dseq: DseqSchema,
    manifest: z.string(),
    signTx: SignTxResponseOutputSchema.shape.data
  })
});

export const CloseDeploymentParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

export const CloseDeploymentResponseSchema = z.object({
  data: z.object({
    success: z.boolean()
  })
});

export const DepositDeploymentRequestSchema = z.object({
  data: z.object({
    dseq: DseqSchema.describe("Deployment sequence number"),
    deposit: z.number().describe("Amount to deposit in dollars (e.g. 5.5). Accepted for backwards compatibility; automatic funding makes it unnecessary.")
  })
});

export const DepositDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const UpdateDeploymentRequestSchema = z.object({
  data: z.object({
    sdl: z.string(),
    name: DeploymentNameSchema.optional().openapi({
      description:
        "Renames the deployment. Omitting it keeps the name the deployment already carries, unlike the rest of the definition this endpoint replaces wholesale."
    })
  })
});

type SdlExposeNode = NonNullable<SDLInput["services"][string]["expose"]>[number];
type SdlNextCase = NonNullable<NonNullable<SdlExposeNode["http_options"]>["next_cases"]>[number];

/** A key carrying `=` would be written as `NAME=REST=value` and read back as a different variable, silently overwriting it and leaving the supplied value unsealed. */
const ENV_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const PatchEnvSchema = z.record(z.string().regex(ENV_VARIABLE_NAME), z.string().nullable()).openapi({
  description:
    "Merged into the service's env, keyed by environment variable name. A null value removes the variable. A patched variable is re-appended, so the order of the stored env list may change."
});

/** Every one of these is a uint32 by the time it reaches the provider. */
const UINT32_MAX = 4294967295;

/** The SDL grammar's own ceiling, refused here so the message names the field rather than the whole document. */
const MAX_BODY_SIZE_BYTES = 104857600;

/** A zero body size is the sentinel the provider's hostname operator reads as "this workload predates http options", on which it drops the rest of the block for its own defaults. */
const MIN_BODY_SIZE_BYTES = 1;

/** Providers disagree on what a zero timeout means, nginx's own default under the Gateway API against none at all under ingress, so the ambiguous spelling is refused rather than resolved. */
const MIN_TIMEOUT_MS = 1;

const HTTP_NEXT_CASES = ["error", "timeout", "500", "502", "503", "504", "403", "404", "429", "off"] as const satisfies readonly SdlNextCase[];

/** `off` turns retrying off outright, so naming a case to retry on beside it is a contradiction. */
function retriesOffAlone(cases: readonly SdlNextCase[]): boolean {
  return cases.length === 1 || !cases.includes("off");
}

const PatchHttpOptionsSchema = z
  .object({
    maxBodySize: z.number().int().min(MIN_BODY_SIZE_BYTES).max(MAX_BODY_SIZE_BYTES),
    readTimeout: z.number().int().min(MIN_TIMEOUT_MS).max(UINT32_MAX),
    sendTimeout: z.number().int().min(MIN_TIMEOUT_MS).max(UINT32_MAX),
    nextTries: z.number().int().nonnegative().max(UINT32_MAX),
    nextTimeout: z.number().int().nonnegative().max(UINT32_MAX),
    nextCases: z
      .array(z.enum(HTTP_NEXT_CASES))
      .nonempty()
      .refine(retriesOffAlone, { message: '"off" cannot be combined with other cases' })
      .openapi({ description: 'Conditions the proxy retries on. Replaces the existing list; "off" disables retrying and stands alone.' })
  })
  .partial();

const PatchExposeSchema = z
  .object({
    accept: z.array(z.string()).openapi({
      description:
        "Custom domains. Replaces the existing list. Emptying it is rejected by providers that do not generate a hostname of their own, which leaves the patch recorded but undeployed."
    }),
    httpOptions: PatchHttpOptionsSchema
  })
  .partial();

/** Naming a field is not patching one: `{ expose: {} }` reaches the writer with nothing to write, so an empty record has to count for as little as an empty patch. */
function assignsAField(patch: Record<string, unknown>): boolean {
  return Object.values(patch).some(value => !isEmptyRecord(value));
}

/** An array is a value even when empty, because `command: []` clears the list the service declared. */
function isEmptyRecord(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const PatchServiceSchema = z
  .object({
    image: z.string(),
    command: z.array(z.string()).nullable(),
    args: z.array(z.string()).nullable(),
    env: PatchEnvSchema,
    credentials: z
      .object({ host: z.string(), username: z.string(), password: z.string() })
      .nullable()
      .openapi({ description: "Private registry pull credentials. Null clears them." }),
    expose: z.record(z.string(), PatchExposeSchema).openapi({
      description: "Keyed by container port. Only hosts and http options are patchable; endpoint kind and count are fixed at create."
    }),
    storage: z.record(z.string(), z.object({ mount: z.string(), readOnly: z.boolean() }).partial()).openapi({
      description: "Keyed by volume name. Mount point and read-only flag only — sizes are fixed at create."
    })
  })
  .partial();

export const UpdateDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema
});

export const PatchDeploymentParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

/** A seal is a write no service patch can describe, so naming a service and changing none of its fields is how a caller asks for a rotation and nothing else. */
function patchesSomething(data: { services: Record<string, Record<string, unknown>>; sealedSecrets?: string }): boolean {
  return !!data.sealedSecrets || Object.values(data.services).some(assignsAField);
}

/** `.refine` rather than a length rule on the record itself, which this zod version does not offer. */
export const PatchDeploymentRequestSchema = z.object({
  data: z
    .object({
      services: z
        .record(z.string(), PatchServiceSchema)
        .refine(services => Object.keys(services).length > 0, { message: "At least one service must be patched" })
        .openapi({
          description: "Keyed by service name. Only the named services are touched; omitted services keep their current definition."
        }),
      sealedSecrets: SealedSecretsSchema.optional().openapi({
        description:
          "Compact JWE sealing a flat name-to-value map, as on create, but holding only the names this patch replaces. Omitted names keep the values the deployment already stores."
      }),
      ifManifestVersion: z.string().min(1).max(MAX_MANIFEST_VERSION_LENGTH).optional().openapi({
        description:
          "Base64 manifest version this patch expects to be current. Rejected with 409 if the deployment has moved on, unless it moved on to the version this very patch produces, which makes a retry of it succeed. Omitting this does not turn the guard off: the patch is then guarded on the version it read for itself, so a concurrent patch still answers 409 rather than overwriting it."
      })
    })
    .refine(patchesSomething, { message: "At least one field must be patched, or sealed secrets supplied" })
});

export const PatchDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema.extend({
    manifestVersion: z.string().openapi({
      description: "Base64 manifest version this patch recorded and committed on chain."
    })
  })
});

export const ListDeploymentsQuerySchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().min(1).default(1000).optional()
});

export const ListDeploymentsResponseSchema = z.object({
  data: z.object({
    deployments: z.array(DeploymentLeaseListItemSchema),
    pagination: z.object({
      total: z.number(),
      skip: z.number(),
      limit: z.number(),
      hasMore: z.boolean()
    })
  })
});

export const deploymentListMaxLimit = 100;

export const ListWithResourcesParamsSchema = z.object({
  address: AkashAddressSchema.openapi({
    description: "Wallet Address",
    example: openApiExampleAddress
  }),
  skip: z.coerce.number().min(0).openapi({
    description: "Deployments to skip",
    example: 10
  }),
  limit: z.coerce.number().min(1).max(deploymentListMaxLimit).openapi({
    description: "Deployments to return",
    example: 10
  })
});

export const ListWithResourcesQuerySchema = z.object({
  status: z.enum(["active", "closed"]).openapi({
    description: "Filter by status",
    example: "closed"
  }),
  reverseSorting: z
    .string()
    .optional()
    .transform(val => val === "true")
    .openapi({
      description: "Reverse sorting",
      example: "true"
    })
});

export const ListWithResourcesResponseSchema = z.object({
  count: z.number(),
  results: z.array(
    z.object({
      owner: z.string(),
      dseq: DseqSchema,
      status: z.string(),
      createdHeight: z.number(),
      cpuUnits: z.number(),
      gpuUnits: z.number(),
      memoryQuantity: z.number(),
      storageQuantity: z.number(),
      leases: z.array(
        z.object({
          id: z.string(),
          owner: z.string(),
          provider: z
            .object({
              address: z.string(),
              hostUri: z.string()
            })
            .optional(),
          dseq: DseqSchema,
          gseq: z.number(),
          oseq: z.number(),
          state: z.string(),
          price: z.object({ denom: z.string(), amount: z.string() })
        })
      )
    })
  )
});

export const GetDeploymentByOwnerDseqParamsSchema = z.object({
  owner: AkashAddressSchema.openapi({
    description: "Owner's Address",
    example: openApiExampleAddress
  }),
  dseq: DseqSchema.openapi({ description: "Deployment sequence number" })
});

export const GetDeploymentByOwnerDseqResponseSchema = z.object({
  owner: z.string(),
  dseq: DseqSchema,
  balance: z.number(),
  denom: z.string(),
  status: z.string(),
  totalMonthlyCostUDenom: z.number(),
  leases: z.array(
    z.object({
      gseq: z.number(),
      oseq: z.number(),
      provider: z
        .object({
          address: z.string(),
          hostUri: z.string(),
          isDeleted: z.boolean(),
          attributes: z.array(
            z.object({
              key: z.string(),
              value: z.string()
            })
          )
        })
        .nullable(),
      status: z.string(),
      monthlyCostUDenom: z.number(),
      cpuUnits: z.number(),
      gpuUnits: z.number(),
      memoryQuantity: z.number(),
      storageQuantity: z.number()
    })
  ),
  events: z.array(
    z.object({
      txHash: z.string(),
      date: z.date(),
      type: z.string()
    })
  ),
  other: DeploymentInfoSchema
});

export const GetWeeklyDeploymentCostResponseSchema = z.object({
  data: z.object({
    weeklyCost: z.number().describe("Total weekly cost in USD for all deployments with auto top-up enabled")
  })
});

export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateLeaseResponse = z.infer<typeof CreateLeaseResponseSchema>;
export type ConsoleSettings = z.infer<typeof ConsoleSettingsSchema>;
export type GetDeploymentResponse = z.infer<typeof GetDeploymentResponseSchema>;
export type CreateDeploymentRequest = z.infer<typeof CreateDeploymentRequestSchema>;
export type CreateDeploymentResponse = z.infer<typeof CreateDeploymentResponseSchema>;
export type CloseDeploymentResponse = z.infer<typeof CloseDeploymentResponseSchema>;
export type DepositDeploymentRequest = z.infer<typeof DepositDeploymentRequestSchema>;
export type DepositDeploymentResponse = z.infer<typeof DepositDeploymentResponseSchema>;
export type UpdateDeploymentRequest = z.infer<typeof UpdateDeploymentRequestSchema>;
export type PatchService = z.infer<typeof PatchServiceSchema>;
export type PatchDeploymentRequest = z.infer<typeof PatchDeploymentRequestSchema>;
export type PatchDeploymentResponse = z.infer<typeof PatchDeploymentResponseSchema>;
export type UpdateDeploymentResponse = z.infer<typeof UpdateDeploymentResponseSchema>;
export type ListWithResourcesParams = z.infer<typeof ListWithResourcesParamsSchema>;
export type ListWithResourcesQuery = z.infer<typeof ListWithResourcesQuerySchema>;
export type ListWithResourcesResponse = z.infer<typeof ListWithResourcesResponseSchema>;
export type ListDeploymentsItem = z.infer<typeof DeploymentLeaseListItemSchema>;
export type GetDeploymentByOwnerDseqResponse = z.infer<typeof GetDeploymentByOwnerDseqResponseSchema>;
export type GetWeeklyDeploymentCostResponse = z.infer<typeof GetWeeklyDeploymentCostResponseSchema>;
