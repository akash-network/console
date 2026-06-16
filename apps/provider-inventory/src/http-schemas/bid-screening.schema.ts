import { z } from "@hono/zod-openapi";

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

const ResourceSchema = z.object({
  id: z.number().int().openapi({ description: "Resource unit ID", example: 1 }),
  cpu: z.object({
    units: ResourceValueSchema,
    attributes: z.array(AttributeSchema).optional()
  }),
  memory: z.object({
    quantity: ResourceValueSchema,
    attributes: z.array(AttributeSchema).optional()
  }),
  gpu: z.object({
    units: ResourceValueSchema,
    attributes: z.array(AttributeSchema).optional()
  }),
  storage: z.array(StorageResourceSchema),
  endpoints: z.array(z.unknown()).optional().optional()
});

const PriceSchema = z.object({
  denom: z.string(),
  amount: UIntStringSchema
});

const ResourceUnitSchema = z.object({
  resource: ResourceSchema,
  count: z.number().int().min(1).openapi({ description: "Replica count", example: 1 }),
  price: PriceSchema
});

const SignedBySchema = z.object({
  allOf: z.array(z.string()).default([]),
  anyOf: z.array(z.string()).default([])
});

const RequirementsSchema = z.object({
  signedBy: SignedBySchema.default({}),
  attributes: z.array(AttributeSchema).default([])
});

const SUPPORTED_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));
export const BidScreeningRequestSchema = z.object({
  requirements: RequirementsSchema.default({}),
  resources: z.array(ResourceUnitSchema).openapi({ description: "Resource units with replica counts" }),
  timezone: z
    .string()
    .refine(val => SUPPORTED_TIMEZONES.has(val), { message: "Timezone is not supported" })
    .openapi({ description: "Client timezone, validated against supported Node.js Intl timezones", example: "America/Chicago" })
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
  incidents: z
    .array(
      z.object({
        date: z.string().openapi({ description: "Local calendar day, YYYY-MM-DD", example: "2026-06-01" }),
        hasOpenIncident: z.boolean().openapi({ description: "True if the provider currently has any open incident" }),
        incidentCount: z.number().int().openapi({ description: "Number of incident intervals overlapping that day" }),
        downtimeSeconds: z.number().int().openapi({ description: "Downtime clipped to that day, in seconds (max 86400)" })
      })
    )
    .openapi({ description: "Per-day downtime over a rolling 7-day window" })
});

export const BidScreeningResponseSchema = z.object({
  providers: z.array(ProviderResultSchema)
});
export type BidScreeningResponse = z.infer<typeof BidScreeningResponseSchema>;

export const BidScreeningErrorSchema = z.object({
  error: z.string(),
  message: z.string()
});
