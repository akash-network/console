import { z } from "zod";

// Response schema
export const UserApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Request schemas
export const CreateUserApiKeyRequestSchema = z.object({
  data: z.object({
    description: z.string().optional(),
    expiresAt: z.string().datetime().optional()
  })
});

export const UpdateUserApiKeyRequestSchema = z.object({
  data: z.object({
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().optional()
  })
});

export const FindUserApiKeyParamsSchema = z.object({
  userId: z.string().uuid(),
  id: z.string().uuid()
});

export type UserApiKeyResponse = {
  data: z.infer<typeof UserApiKeyResponseSchema>;
};

export type CreateUserApiKeyRequest = z.infer<typeof CreateUserApiKeyRequestSchema>;
export type UpdateUserApiKeyRequest = z.infer<typeof UpdateUserApiKeyRequestSchema>;
