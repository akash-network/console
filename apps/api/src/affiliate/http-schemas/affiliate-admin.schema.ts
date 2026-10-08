import { z } from "@hono/zod-openapi";

const MAX_ACTOR_LENGTH = 255;
const MAX_CODE_LENGTH = 32;

const ActorSchema = z.string().trim().min(1).max(MAX_ACTOR_LENGTH);

export const ApproveAffiliateRequestSchema = z.object({
  data: z
    .object({
      userId: z.string().uuid().optional(),
      email: z.string().trim().email().optional(),
      code: z.string().trim().min(1).max(MAX_CODE_LENGTH).optional(),
      actor: ActorSchema
    })
    .refine(data => data.userId !== undefined || data.email !== undefined, {
      message: "Provide a userId or an email",
      path: ["userId"]
    })
});

export const ApproveAffiliateResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    code: z.string(),
    approvedAt: z.string().datetime()
  })
});

export const RevokeAffiliateParamsSchema = z.object({
  code: z.string()
});

export const RevokeAffiliateRequestSchema = z.object({
  data: z.object({
    actor: ActorSchema
  })
});

export const RevokeAffiliateResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    code: z.string(),
    revokedAt: z.string().datetime()
  })
});

export type ApproveAffiliateRequest = z.infer<typeof ApproveAffiliateRequestSchema>;
export type ApproveAffiliateResponse = z.infer<typeof ApproveAffiliateResponseSchema>;
export type RevokeAffiliateRequest = z.infer<typeof RevokeAffiliateRequestSchema>;
