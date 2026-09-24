import type { SDLInput } from "@akashnetwork/chain-sdk";
import { DeploymentInfoSchema } from "@akashnetwork/http-sdk";
import { z } from "@hono/zod-openapi";

import { SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";
import { MAX_MANIFEST_VERSION_LENGTH, MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/deployment/utils/deployment-name/deployment-name";
import { openApiExampleAddress } from "@src/utils/constants";
import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";
import { LeaseStatusResponseSchema } from "./lease.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "./runtime-limit";

const DetectedGpuSchema = z.object({
  vendor: z.string().nullable().openapi({ description: "Canonical vendor key, e.g. `nvidia`. Null for a card the console's model catalog does not list." }),
  model: z.string().nullable().openapi({ description: "Canonical SDL model key, e.g. `h100`. Null for a card the console's model catalog does not list." }),
  displayName: z.string().openapi({ description: "Marketing-correct label, e.g. `H100`, falling back to what the driver reported for an unlisted card." }),
  memoryMb: z.number().int().openapi({ description: "Per-card memory as the driver reports it, in MiB." }),
  interface: z.string().nullable().openapi({ description: "`sxm` or `pcie` when the catalog names one, else null." }),
  count: z.number().int().positive().openapi({ description: "Identical cards folded into one entry." })
});

const DetectedLeaseGpusSchema = z
  .object({
    services: z.array(z.object({ service: z.string(), gpus: z.array(DetectedGpuSchema) })),
    driverVersion: z.string().nullable(),
    detectedAt: z.string().datetime()
  })
  .openapi({
    description:
      "GPUs the console observed running inside this lease's containers, as distinct from the models its group requested. Absent until the console has looked, and for a lease it cannot look inside."
  });

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
  reclamation: z
    .object({
      window: z.string().optional(),
      started_at: z.string().optional(),
      deadline: z.string().optional(),
      reason: z.string().optional()
    })
    .optional()
    .openapi({
      description:
        "Present only on a lease its provider has flagged for reclamation. `deadline` is unix seconds; `reason` is a `lease_closed_reason_*` enum name."
    }),
  detectedGpus: DetectedLeaseGpusSchema.optional(),
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

/** A sibling of `consoleSettings` rather than a member of it, because that object is null unless both an sdl and a manifest version were recorded, which a deployment named on its own never has. */
const DeploymentNameResponseSchema = z.string().nullable().openapi({
  description: "The name this deployment carries, or null for one created before the console recorded names."
});

/** The fields a list shows, excluding both the ones that cost a chain read per row and `autoTopUpEnabled`, which no client can set and which every deployment a user made carries as true. */
const ListedDeploymentSettingsSchema = z.object({
  name: DeploymentNameResponseSchema,
  runtimeLimitHours: z.number().int().nullable().openapi({
    description: "Runtime limit in hours chosen at deployment creation, or null for always-on funding."
  }),
  runtimeEndsAt: z.string().datetime().nullable().openapi({
    description: "When the runtime limit expires, or null for a limit no lease has anchored yet."
  }),
  closed: z.boolean().openapi({
    description: "The console's own bookkeeping, which can trail `deployment.state`. Trust `deployment.state` when the two disagree."
  })
});

const DeploymentLeaseListItemSchema = DeploymentResponseSchema.extend({
  leases: z.array(DeploymentLeaseSchema.omit({ status: true })),
  name: DeploymentNameResponseSchema,
  groups: DeploymentInfoSchema.shape.groups.openapi({
    description: "The resource groups the deployment declares, as recorded for it rather than as its SDL spells them."
  }),
  settings: ListedDeploymentSettingsSchema.nullable().openapi({
    description: "What the console holds about this deployment, or null when it holds nothing."
  })
});

const ConsoleSettingsSchema = z.object({
  sdl: z.string().openapi({
    description: "The SDL the console stored for this deployment. Re-serialized YAML, so not byte-identical to the submitted document."
  }),
  manifestVersion: z.string().openapi({
    description: "Base64 of the manifest version the console recorded for this deployment. Deliberately not a hash of the `sdl` above."
  })
});

export const GetDeploymentResponseSchema = z.object({
  data: DeploymentResponseSchema.extend({
    name: DeploymentNameResponseSchema,
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

/** Kubernetes' own env var name grammar, which the SDL accepts and a stored `NAME=value` entry can round-trip. */
const ENV_VARIABLE_NAME = /^[-._a-zA-Z][-._a-zA-Z0-9]*$/;

const PatchEnvSchema = z.record(z.string().regex(ENV_VARIABLE_NAME), z.string().nullable()).openapi({
  description:
    "Merged into the service's env, keyed by environment variable name. A null value removes the variable. A patched variable is re-appended, so the order of the stored env list may change. Written values are sealed unless the request carries `sealedSecrets`."
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

const MIN_PORT = 1;
const MAX_PORT = 65535;

const PortNumberSchema = z.number().int().min(MIN_PORT).max(MAX_PORT);

const PatchExposeSchema = z
  .object({
    port: PortNumberSchema.openapi({
      description:
        "Moves the container port the workload listens on. The entry is still addressed by the port it declares today. Refused onto a port the service already exposes, and on an endpoint reached through a leased IP."
    }),
    as: PortNumberSchema.openapi({
      description:
        "Moves the port the endpoint is reached on. Refused when it would change the endpoint's kind (a public TCP endpoint moving onto or off port 80), onto a port another endpoint of the service uses, and on an endpoint reached through a leased IP."
    }),
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

export function assignsAnyServiceField(services: Record<string, Record<string, unknown>> | undefined): boolean {
  return Object.values(services ?? {}).some(assignsAField);
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
      description:
        "Keyed by the container port the stored SDL declares. Port numbers, hosts and http options are patchable; protocol, routing, endpoint kind and count are fixed at create. A random-port endpoint whose numbers change gets a new public port from the provider, and so can the service's other random-port endpoints when a container port move reorders them."
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

/** A seal and a name are each a write no service patch can describe, so naming a service and changing none of its fields is how a caller asks for a rotation and nothing else. */
function patchesSomething(data: { services?: Record<string, Record<string, unknown>>; name?: string; sealedSecrets?: string }): boolean {
  return !!data.sealedSecrets || !!data.name || assignsAnyServiceField(data.services);
}

/** `.refine` rather than a length rule on the record itself, which this zod version does not offer. */
export const PatchDeploymentRequestSchema = z.object({
  data: z
    .object({
      services: z
        .record(z.string(), PatchServiceSchema)
        .refine(services => Object.keys(services).length > 0, { message: "At least one service must be patched" })
        .optional()
        .openapi({
          description:
            "Keyed by service name. Only the named services are touched; omitted services keep their current definition. Omit it entirely to patch nothing about the definition, which is how a deployment is renamed on its own."
        }),
      name: DeploymentNameSchema.optional().openapi({
        description:
          "Renames the deployment. Supplied on its own it is the only patch that touches no definition, so it works on a deployment the console holds no SDL for and sends neither a deployment update nor a manifest."
      }),
      sealedSecrets: SealedSecretsSchema.optional().openapi({
        description:
          "Compact JWE sealing a flat name-to-value map, as on create, but holding only the names this patch replaces. Omitted names keep the values the deployment already stores. Its presence also says which values are secret, as on create: a patch carrying a seal stores the env values it writes as submitted, while one carrying none seals them. A seal of an empty map is how a caller writes plain variables without replacing any secret."
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
    name: DeploymentNameResponseSchema,
    manifestVersion: z.string().optional().openapi({
      description: "Base64 manifest version this patch recorded, which the deployment is now on. Absent for a rename, which records none."
    })
  })
});

export const deploymentListMaxLimit = 100;

export const DeploymentListStateSchema = z.enum(["active", "closed"]);
export type DeploymentListState = z.infer<typeof DeploymentListStateSchema>;

export const ListDeploymentsQuerySchema = z.object({
  state: DeploymentListStateSchema.default("active").openapi({
    description: "Which of the owner's deployments to list. `closed` serves the archive."
  }),
  reverse: z
    .enum(["true", "false"])
    .default("false")
    .transform(value => value === "true")
    .openapi({
      description: "Newest deployment first when true, rather than the default oldest-first order."
    }),
  search: z
    .string()
    .trim()
    .max(MAX_DEPLOYMENT_NAME_LENGTH)
    .optional()
    .transform(value => value || undefined)
    .openapi({
      description:
        "Case-insensitive substring matched against each deployment's console name and its dseq. It spans every deployment in `state` before paging, so `total` and `hasMore` describe the matches rather than the state."
    }),
  skip: z.coerce.number().int().min(0).default(0).openapi({
    description: "Deployments to skip before the page begins."
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(deploymentListMaxLimit)
    .default(deploymentListMaxLimit)
    .openapi({
      description: `Deployments per page, at most ${deploymentListMaxLimit}. Omitting it pages from the start rather than returning every deployment, so page on while \`hasMore\` is true.`
    })
});

export type ListDeploymentsQuery = z.infer<typeof ListDeploymentsQuerySchema>;

export const ListDeploymentsResponseSchema = z.object({
  data: z.object({
    deployments: z.array(DeploymentLeaseListItemSchema),
    pagination: z.object({
      total: z.number().nullable().openapi({
        description:
          "Deployments the owner holds in this state, counted from the console's own index, so it can briefly lag behind the list itself. Null when that index cannot answer, which leaves the count unknown rather than understated; page on `hasMore` regardless."
      }),
      skip: z.number(),
      limit: z.number(),
      hasMore: z.boolean().openapi({ description: "Whether a further page exists." })
    })
  })
});

/** One page of any list that shows names is at most this long, so a lookup never asks for more than a screen shows. */
export const MAX_DEPLOYMENT_NAMES_PER_REQUEST = 100;

/** The answer is keyed by what was asked, so only the canonical spelling is accepted: a leading zero would come back under a key the caller never sent. */
const CanonicalDseqSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .openapi({ pattern: "^[1-9]\\d*$" });

/** Hono hands a query key given once as a string and a repeated one as an array, and both spell one lookup. */
const RepeatedDseqSchema = z.preprocess(
  value => (Array.isArray(value) ? value : [value]),
  z.array(CanonicalDseqSchema).min(1).max(MAX_DEPLOYMENT_NAMES_PER_REQUEST)
);

export const GetDeploymentNamesQuerySchema = z.object({
  dseq: RepeatedDseqSchema.openapi({
    description: `Deployment sequence numbers to resolve names for, repeated once per deployment, at most ${MAX_DEPLOYMENT_NAMES_PER_REQUEST} per request. Written without leading zeros, as the other deployment endpoints return them.`
  })
});

export const GetDeploymentNamesResponseSchema = z.object({
  data: z.record(z.string(), DeploymentNameResponseSchema).openapi({
    description: "Keyed by the dseqs asked about. Null for a deployment the console holds no name for, whether it recorded nothing or recorded it unnamed."
  })
});

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
export type GetDeploymentNamesResponse = z.infer<typeof GetDeploymentNamesResponseSchema>;
export type GetDeploymentByOwnerDseqResponse = z.infer<typeof GetDeploymentByOwnerDseqResponseSchema>;
export type GetWeeklyDeploymentCostResponse = z.infer<typeof GetWeeklyDeploymentCostResponseSchema>;
