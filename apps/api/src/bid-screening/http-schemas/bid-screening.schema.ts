import { z } from "@hono/zod-openapi";

import { isSupportedTimeZone } from "@src/utils/date/date";

const UIntStringSchema = z.string().regex(/^\d+$/, "Must be an unsigned integer string");

const ResourceValueSchema = z.object({
  val: z
    .string()
    .max(80)
    .transform(str => {
      if (/^\d+$/.test(str)) return BigInt(str);
      const parsed = Buffer.from(str, "base64").toString("utf-8");
      if (/^\d+$/.test(parsed)) return BigInt(parsed);
      return NaN;
    })
    .refine(
      (val): val is bigint => !Number.isFinite(val) && typeof val === "bigint" && val >= 0n,
      "Must be a non-negative integer or its protobuf base64-encoded representation"
    )
});

// Mirrors AttributeNameRegexpStringWildcard in akash-network/chain-sdk
// (go/node/types/v1beta3/attribute.go) — only trailing `*` is a permitted glob metachar.
const SDL_ATTRIBUTE_KEY_REGEX = /^([a-zA-Z][\w/.-]{1,126}[\w*]?)$/;
const AttributeSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(128)
    .regex(SDL_ATTRIBUTE_KEY_REGEX, "Invalid attribute key format")
    .openapi({ description: "Attribute key", example: "persistent" }),
  value: z.string().openapi({ description: "Attribute value", example: "false" })
});

const StorageResourceSchema = z
  .object({
    name: z.string().openapi({ description: "Storage volume name", example: "default" }),
    quantity: ResourceValueSchema,
    attributes: z.array(AttributeSchema).optional()
  })
  .superRefine((vol, ctx) => {
    const isPersistent = vol.attributes?.some(a => a.key === "persistent" && a.value === "true");
    if (!isPersistent) return;
    const storageClass = vol.attributes?.find(a => a.key === "class")?.value;
    if (!storageClass || storageClass === "ram") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Persistent storage volume "${vol.name}" must specify a valid storage class (not "${storageClass || "empty"}")`,
        path: ["attributes"]
      });
    }
  });

// Mirrors CPU_ARCHITECTURES in apps/provider-inventory, which owns the screening this route proxies to.
const CPU_ARCHITECTURES = ["amd64", "arm64"] as const;

const CpuResourceSchema = z
  .object({
    units: ResourceValueSchema,
    attributes: z.array(AttributeSchema).optional()
  })
  .superRefine((cpu, ctx) => {
    let archSeen = false;

    for (const attr of cpu.attributes ?? []) {
      if (attr.key !== "arch") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unsupported CPU attribute "${attr.key}": "arch" is the only one`, path: ["attributes"] });
      } else if (archSeen) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate CPU attribute "arch": a resource asks for one architecture`, path: ["attributes"] });
      } else if (!CPU_ARCHITECTURES.some(architecture => architecture === attr.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported CPU architecture "${attr.value}": expected ${CPU_ARCHITECTURES.join(" or ")}`,
          path: ["attributes"]
        });
      } else {
        archSeen = true;
      }
    }
  });

/** Mirrors the caps in apps/provider-inventory, which owns the screening this route proxies to. */
export const MAX_REPLICA_COUNT = 100;
export const MAX_RESOURCE_UNITS = 32;
export const MAX_STORAGE_VOLUMES = 16;
export const MAX_SIGNED_BY_AUDITORS = 16;
export const MAX_PLACEMENT_ATTRIBUTES = 32;

const ResourceSchema = z
  .object({
    id: z.number().int().openapi({ description: "Resource unit ID", example: 1 }),
    cpu: CpuResourceSchema,
    memory: z.object({
      quantity: ResourceValueSchema,
      attributes: z.array(AttributeSchema).optional()
    }),
    gpu: z.object({
      units: ResourceValueSchema,
      attributes: z.array(AttributeSchema).optional()
    }),
    storage: z.array(StorageResourceSchema).max(MAX_STORAGE_VOLUMES),
    endpoints: z.array(z.unknown()).optional().optional()
  })
  .refine(
    resource =>
      resource.cpu.units.val > 0n ||
      resource.memory.quantity.val > 0n ||
      resource.gpu.units.val > 0n ||
      resource.storage.some(volume => volume.quantity.val > 0n),
    "A resource unit must request some CPU, memory, GPU or storage"
  );

const PriceSchema = z.object({
  denom: z.string(),
  amount: UIntStringSchema
});

const ResourceUnitSchema = z.object({
  resource: ResourceSchema,
  count: z.number().int().min(1).max(MAX_REPLICA_COUNT).openapi({ description: "Replica count", example: 1 }),
  price: PriceSchema
});

const SignedBySchema = z.object({
  allOf: z.array(z.string()).max(MAX_SIGNED_BY_AUDITORS).default([]),
  anyOf: z.array(z.string()).max(MAX_SIGNED_BY_AUDITORS).default([])
});

const RequirementsSchema = z.object({
  signedBy: SignedBySchema.default({}),
  attributes: z.array(AttributeSchema).max(MAX_PLACEMENT_ATTRIBUTES).default([])
});

export const BidScreeningRequestSchema = z.object({
  requirements: RequirementsSchema.default({}),
  resources: z.array(ResourceUnitSchema).max(MAX_RESOURCE_UNITS).openapi({ description: "Resource units with replica counts" }),
  timezone: z
    .string()
    .refine(isSupportedTimeZone, { message: "Timezone is not supported" })
    .openapi({ description: "Client IANA timezone, validated against zones the runtime recognizes", example: "America/Chicago" }),
  reclamationWindow: z.number().int().positive().optional().openapi({
    description:
      "Optional reclamation window in seconds; if provided, only providers with a reclamationWindow greater than or equal to this value will be considered",
    example: 3600
  })
});
export type BidScreeningRequest = z.infer<typeof BidScreeningRequestSchema>;

const ProviderResultSchema = z.object({
  owner: z.string().openapi({ description: "Provider address", example: "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf" }),
  hostUri: z.string().openapi({ description: "Provider HTTPS endpoint", example: "https://provider.europlots.com:8443" }),
  isAudited: z.boolean().openapi({ description: "True if signed by a known auditor" }),
  createdAt: z
    .string()
    .datetime()
    .openapi({ description: "ISO 8601 timestamp marking when the provider was first enrolled in the inventory", example: "2026-01-01T00:00:00.000Z" }),
  location: z.string().nullable().openapi({
    description: "Provider region from the location-region attribute (signed preferred, else self-declared); null if unset",
    example: "us-west"
  }),
  organization: z.string().nullable().openapi({
    description: "Provider organization from the organization attribute (signed preferred, else self-declared); null if unset",
    example: "Akash"
  }),
  availableGpus: z.number().int().nonnegative().openapi({
    description: "Free GPUs matching the request on nodes that can also fit one replica of it; 0 when the request asks for no GPU",
    example: 4
  }),
  incidents: z
    .array(
      z.object({
        date: z.string().openapi({ description: "Local calendar day, YYYY-MM-DD", example: "2026-06-01" }),
        hasOpenIncident: z.boolean().openapi({ description: "True if the provider currently has any open incident" }),
        incidentCount: z.number().int().openapi({ description: "Number of incident intervals overlapping that day" }),
        downtimeSeconds: z.number().int().openapi({ description: "Downtime clipped to that day, in seconds (max 86400)" })
      })
    )
    .openapi({ description: "Per-day downtime over a rolling 7-day window" }),
  isNotBidding: z.boolean().optional().openapi({
    description:
      "Present when the request asks for a GPU model: true when Console's GPU checks of the requested models listed the provider on every check of the last 48 hours, at least 3 of them, and it bid on none"
  }),
  lastCheckBidAt: z.string().datetime().nullable().optional().openapi({
    description:
      "Present when the request asks for a GPU model: when the provider last bid on a Console GPU check of the requested models; null if not in 30 days",
    example: "2026-10-18T06:01:30.000Z"
  })
});

export const BidScreeningResponseSchema = z.object({
  providers: z.array(ProviderResultSchema)
});
export type BidScreeningResponse = z.infer<typeof BidScreeningResponseSchema>;

export const BidScreeningErrorSchema = z.object({
  error: z.string(),
  message: z.string()
});
