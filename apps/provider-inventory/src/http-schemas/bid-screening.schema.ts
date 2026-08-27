import { AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
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
  endpoints: z
    .array(
      z.object({
        kind: z.enum(["SHARED_HTTP", "RANDOM_PORT", "LEASED_IP", "UNRECOGNIZED"]).optional(),
        sequenceNumber: z.number({ coerce: true }).int().nonnegative().optional()
      })
    )
    .optional()
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

const VerificationTierSchema = z.union([
  z.literal(VerificationTier.verification_tier_unspecified),
  z.literal(VerificationTier.verification_tier_identified),
  z.literal(VerificationTier.verification_tier_verified),
  z.literal(VerificationTier.verification_tier_established),
  z.literal(VerificationTier.verification_tier_trusted)
]);

const CapabilityFlagSchema = z.union([
  z.literal(CapabilityFlag.capability_tee_hardware_attestation),
  z.literal(CapabilityFlag.capability_confidential_computing),
  z.literal(CapabilityFlag.capability_persistent_storage),
  z.literal(CapabilityFlag.capability_bare_metal)
]);

const AnyVerificationTierSchema = z.nativeEnum(VerificationTier);
const AnyCapabilityFlagSchema = z.nativeEnum(CapabilityFlag);
const AnyAuditorSelectionModeSchema = z.nativeEnum(AuditorSelectionMode);

const AuditorSelectionModeSchema = z.union([
  z.literal(AuditorSelectionMode.auditor_selection_mode_unspecified),
  z.literal(AuditorSelectionMode.auditor_selection_mode_any),
  z.literal(AuditorSelectionMode.auditor_selection_mode_all)
]);

const ProviderVerificationSummarySchema = z.object({
  bestStatusValidTier: AnyVerificationTierSchema,
  tierGateTier: AnyVerificationTierSchema,
  capabilities: z.array(AnyCapabilityFlagSchema),
  validAttestationCount: z.number().int().nonnegative(),
  validAuditors: z.array(z.string()),
  snapshotState: z.enum(["unknown", "not_posted", "current", "stale", "suspended"]),
  observedHeight: z.string()
});

export const VerificationRequirementSchema = z
  .object({
    minTier: VerificationTierSchema,
    requiredCapabilities: z.array(CapabilityFlagSchema).default([]),
    requiredAuditors: z.array(z.string().min(1)).default([]),
    auditorMode: AuditorSelectionModeSchema.default(AuditorSelectionMode.auditor_selection_mode_unspecified),
    minAuditorCount: z.number().int().min(0).max(4_294_967_295).default(0)
  })
  .superRefine((requirement, ctx) => {
    if (requirement.minTier !== VerificationTier.verification_tier_unspecified) return;
    if (requirement.requiredCapabilities.length === 0 && requirement.requiredAuditors.length === 0 && requirement.minAuditorCount === 0) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Tier 0 cannot be combined with capabilities, auditors, or a minimum auditor count"
    });
  });
export type VerificationRequirementInput = z.infer<typeof VerificationRequirementSchema>;

const RequirementsSchema = z.object({
  signedBy: SignedBySchema.default({}),
  attributes: z.array(AttributeSchema).default([]),
  verification: VerificationRequirementSchema.optional()
});

/**
 * Accepts any IANA zone the runtime recognizes, including aliases such as `Asia/Kolkata`, `UTC`, or
 * `US/Eastern` that browsers report but `Intl.supportedValuesOf("timeZone")` omits (it lists only
 * canonical names). Mirrors what Postgres `AT TIME ZONE` accepts downstream.
 */
function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
export const BidScreeningRequestSchema = z.object({
  requirements: RequirementsSchema.default({}),
  resources: z.array(ResourceUnitSchema).openapi({ description: "Resource units with replica counts" }),
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
  verification: z
    .discriminatedUnion("outcome", [
      z.object({
        outcome: z.literal("pass"),
        summary: ProviderVerificationSummarySchema
      }),
      z.object({
        outcome: z.literal("not_evaluated"),
        incompleteFacts: z.array(z.enum(["params", "attestations", "graces", "snapshot", "module_inactive"])),
        summary: ProviderVerificationSummarySchema
      })
    ])
    .optional(),
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

const VerificationFailureSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("snapshot_not_posted") }),
  z.object({ code: z.literal("snapshot_suspended") }),
  z.object({ code: z.literal("snapshot_stale") }),
  z.object({ code: z.literal("insufficient_tier"), actual: AnyVerificationTierSchema, required: AnyVerificationTierSchema }),
  z.object({ code: z.literal("missing_capability"), capability: AnyCapabilityFlagSchema }),
  z.object({ code: z.literal("insufficient_auditor_count"), actual: z.number().int().nonnegative(), required: z.number().int().nonnegative() }),
  z.object({ code: z.literal("required_auditor_not_found"), mode: AnyAuditorSelectionModeSchema, missing: z.array(z.string()) })
]);

const VerificationExclusionSchema = z.object({
  owner: z.string(),
  firstFailure: VerificationFailureSchema,
  failures: z.array(VerificationFailureSchema).min(1),
  summary: ProviderVerificationSummarySchema
});

export const BidScreeningResponseSchema = z.object({
  providers: z.array(ProviderResultSchema),
  exclusions: z.array(VerificationExclusionSchema).optional()
});
export type BidScreeningResponse = z.infer<typeof BidScreeningResponseSchema>;

export const BidScreeningErrorSchema = z.object({
  error: z.string(),
  message: z.string()
});
