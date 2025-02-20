import { z } from "zod";

export const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  keyFormat: z.string(),
  apiKey: z.string().optional()
});

export const CreateApiKeySchema = z.object({
  name: z.string(),
  expiresAt: z
    .string()
    .datetime()
    .transform(str => new Date(str))
    .refine(date => date > new Date(), {
      message: "Expiration date must be in the future"
    })
    .optional()
});

export const ListApiKeysSchema = z.array(ApiKeyResponseSchema);

export const UpdateApiKeySchema = z.object({
  name: z.string().optional()
});

export const FindApiKeyParamsSchema = z.object({
  id: z.string().uuid()
});

export const ListApiKeysResponseSchema = z.object({
  data: ListApiKeysSchema
});

export const SingleApiKeyResponseSchema = z.object({
  data: ApiKeyResponseSchema
});

export const CreateApiKeyRequestSchema = z.object({
  data: CreateApiKeySchema
});

export const UpdateApiKeyRequestSchema = z.object({
  data: UpdateApiKeySchema
});

export const ErrorResponseSchema = z.object({
  message: z.string()
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
export type ListApiKeysResponse = z.infer<typeof ListApiKeysResponseSchema>;
export type SingleApiKeyResponse = z.infer<typeof SingleApiKeyResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeyRequestSchema>;
export type FindApiKeyParams = z.infer<typeof FindApiKeyParamsSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ListApiKeys = z.infer<typeof ListApiKeysSchema>;
