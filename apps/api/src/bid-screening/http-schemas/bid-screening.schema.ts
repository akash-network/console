/* v8 ignore start */
import { z } from "@hono/zod-openapi";

const UIntStringSchema = z.string().regex(/^\d+$/, "Must be an unsigned integer string");

const ResourceValueSchema = z.object({
  val: UIntStringSchema.openapi({ description: "String-encoded integer value", example: "1000" })
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
    attributes: z.array(AttributeSchema)
  })
  .superRefine((vol, ctx) => {
    const isPersistent = vol.attributes.some(a => a.key === "persistent" && a.value === "true");
    if (!isPersistent) return;
    const storageClass = vol.attributes.find(a => a.key === "class")?.value;
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
    attributes: z.array(AttributeSchema)
  }),
  memory: z.object({
    quantity: ResourceValueSchema,
    attributes: z.array(AttributeSchema)
  }),
  gpu: z.object({
    units: ResourceValueSchema,
    attributes: z.array(AttributeSchema)
  }),
  storage: z.array(StorageResourceSchema),
  endpoints: z.array(z.unknown()).optional()
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

export const BidScreeningRequestSchema = z.object({
  name: z.string().openapi({ description: "Group name", example: "westcoast" }),
  requirements: RequirementsSchema.default({}),
  resources: z.array(ResourceUnitSchema).min(1).openapi({ description: "Resource units with replica counts" })
});
export type BidScreeningRequest = z.infer<typeof BidScreeningRequestSchema>;

const ProviderResultSchema = z.object({
  owner: z.string().openapi({ description: "Provider address", example: "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf" }),
  hostUri: z.string().openapi({ description: "Provider HTTPS endpoint", example: "https://provider.europlots.com:8443" }),
  region: z.string().nullable().openapi({ description: "Geo-resolved region from IP" }),
  uptime7d: z.number().nullable().openapi({ description: "7-day uptime as decimal (0.0-1.0)", example: 0.998 }),
  isAudited: z.boolean().openapi({ description: "True if signed by a known auditor" })
});

export const BidScreeningResponseSchema = z.object({
  providers: z.array(ProviderResultSchema)
});
export type BidScreeningResponse = z.infer<typeof BidScreeningResponseSchema>;

export const BidScreeningErrorSchema = z.object({
  error: z.string(),
  message: z.string()
});
