import type { JwtTokenPayload } from "@akashnetwork/chain-sdk/web";
import { z } from "zod";

const AccessScopeSchema = z.enum(["send-manifest", "get-manifest", "logs", "shell", "events", "status", "restart", "hostname-migrate", "ip-migrate"]);

const BaseLeasePermissionSchema = z.object({
  provider: z.string()
});

const FullAccessPermissionSchema = BaseLeasePermissionSchema.extend({
  access: z.literal("full")
});

const ScopedAccessPermissionSchema = BaseLeasePermissionSchema.extend({
  access: z.literal("scoped"),
  scope: z.array(AccessScopeSchema)
});

const GranularAccessPermissionSchema = BaseLeasePermissionSchema.extend({
  access: z.literal("granular"),
  deployments: z.array(
    z.object({
      dseq: z.number(),
      scope: z.array(AccessScopeSchema),
      gseq: z.number().optional(),
      oseq: z.number().optional(),
      services: z.array(z.string()).optional()
    })
  )
});

const LeasePermissionSchema = z.discriminatedUnion("access", [FullAccessPermissionSchema, ScopedAccessPermissionSchema, GranularAccessPermissionSchema]);

const FullAccessSchema = z.object({
  access: z.literal("full")
});

const ScopedAccessSchema = z.object({
  access: z.literal("scoped"),
  scope: z.array(AccessScopeSchema)
});

const GranularAccessSchema = z.object({
  access: z.literal("granular"),
  permissions: z.array(LeasePermissionSchema)
});

const LeasesSchema = z.discriminatedUnion("access", [FullAccessSchema, ScopedAccessSchema, GranularAccessSchema]) satisfies z.ZodType<
  JwtTokenPayload["leases"]
>;

export const CreateJwtTokenRequestSchema = z.object({
  ttl: z.number().int().positive(),
  leases: LeasesSchema
});

export type CreateJwtTokenRequest = z.infer<typeof CreateJwtTokenRequestSchema>;

export const CreateJwtTokenResponseSchema = z.object({
  token: z.string()
});
export type CreateJwtTokenResponse = z.infer<typeof CreateJwtTokenResponseSchema>;
