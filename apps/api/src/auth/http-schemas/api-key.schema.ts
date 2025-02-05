import { z } from "zod";

export const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreateApiKeyRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

export const UpdateApiKeyRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional()
});

export const FindApiKeyParamsSchema = z.object({
  id: z.string().uuid()
});

export const ListApiKeysResponseSchema = z.object({
  data: z.array(ApiKeyResponseSchema)
});

export const SingleApiKeyResponseSchema = z.object({
  data: ApiKeyResponseSchema
});

export const CreateApiKeyRequestWrapperSchema = z.object({
  data: CreateApiKeyRequestSchema
});

export const UpdateApiKeyRequestWrapperSchema = z.object({
  data: UpdateApiKeyRequestSchema
});

export const ErrorResponseSchema = z.object({
  message: z.string()
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
export type ListApiKeysResponse = z.infer<typeof ListApiKeysResponseSchema>;
export type SingleApiKeyResponse = z.infer<typeof SingleApiKeyResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestWrapperSchema>;
export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeyRequestWrapperSchema>;
export type FindApiKeyParams = z.infer<typeof FindApiKeyParamsSchema>;
