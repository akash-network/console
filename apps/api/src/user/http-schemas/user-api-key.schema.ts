import { z } from "zod";

// Base schemas
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
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

export const UpdateUserApiKeyRequestSchema = z.object({
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional()
});

// Route parameter schemas
export const UserIdParamSchema = z.object({
  userId: z.string().uuid()
});

export const FindUserApiKeyParamsSchema = UserIdParamSchema.extend({
  id: z.string().uuid()
});

// Response wrapper schemas
export const ListUserApiKeysResponseSchema = z.object({
  data: z.array(UserApiKeyResponseSchema)
});

export const SingleUserApiKeyResponseSchema = z.object({
  data: UserApiKeyResponseSchema
});

export const CreateUserApiKeyRequestWrapperSchema = z.object({
  data: CreateUserApiKeyRequestSchema
});

export const UpdateUserApiKeyRequestWrapperSchema = z.object({
  data: UpdateUserApiKeyRequestSchema
});

// Error response schema
export const ErrorResponseSchema = z.object({
  message: z.string()
});

// Type exports
export type UserApiKeyResponse = z.infer<typeof UserApiKeyResponseSchema>;
export type ListUserApiKeysResponse = z.infer<typeof ListUserApiKeysResponseSchema>;
export type SingleUserApiKeyResponse = z.infer<typeof SingleUserApiKeyResponseSchema>;
export type CreateUserApiKeyRequest = z.infer<typeof CreateUserApiKeyRequestWrapperSchema>;
export type UpdateUserApiKeyRequest = z.infer<typeof UpdateUserApiKeyRequestWrapperSchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
export type FindUserApiKeyParams = z.infer<typeof FindUserApiKeyParamsSchema>;
