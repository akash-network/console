import type { JwtTokenAccessScope, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { z } from "@hono/zod-openapi";

const ACCESS_SCOPES = [
  "send-manifest",
  "get-manifest",
  "logs",
  "shell",
  "events",
  "status",
  "restart",
  "hostname-migrate",
  "ip-migrate",
  "attestation"
] as const satisfies readonly JwtTokenAccessScope[];

const hasNoDuplicates = (items: unknown[]) => new Set(items).size === items.length;

const AccessScopeSchema = z.array(z.enum(ACCESS_SCOPES)).min(1).refine(hasNoDuplicates, "must not repeat an action");

const AkashAddressSchema = z.string().regex(/^akash1[a-z0-9]{38}$/);

const DeploymentPermissionSchema = z
  .object({
    dseq: z.number().int().min(1),
    gseq: z.number().int().min(0).optional(),
    oseq: z.number().int().min(0).optional(),
    scope: AccessScopeSchema,
    services: z.array(z.string().min(1)).min(1).refine(hasNoDuplicates, "must not repeat a service")
  })
  .strict()
  .refine(({ gseq, oseq }) => oseq === undefined || gseq !== undefined, { message: "oseq requires gseq", path: ["oseq"] });

const LeasePermissionSchema = z.discriminatedUnion("access", [
  z.object({ provider: AkashAddressSchema, access: z.literal("full") }).strict(),
  z.object({ provider: AkashAddressSchema, access: z.literal("scoped"), scope: AccessScopeSchema }).strict(),
  z.object({ provider: AkashAddressSchema, access: z.literal("granular"), deployments: z.array(DeploymentPermissionSchema).min(1) }).strict()
]);

const LeasesSchema = z.discriminatedUnion("access", [
  z.object({ access: z.literal("full") }).strict(),
  z.object({ access: z.literal("scoped"), scope: AccessScopeSchema }).strict(),
  z
    .object({
      access: z.literal("granular"),
      permissions: z
        .array(LeasePermissionSchema)
        .min(1)
        .refine(permissions => hasNoDuplicates(permissions.map(({ provider }) => provider)), "must not repeat a provider")
    })
    .strict()
]) satisfies z.ZodType<JwtTokenPayload["leases"]>;

export const CreateJwtTokenRequestSchema = z.object({
  ttl: z.number().int().positive(),
  leases: LeasesSchema
});

export type CreateJwtTokenRequest = z.infer<typeof CreateJwtTokenRequestSchema>;

export const CreateJwtTokenResponseSchema = z.object({
  token: z.string()
});
export type CreateJwtTokenResponse = z.infer<typeof CreateJwtTokenResponseSchema>;
