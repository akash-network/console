import { z } from "@hono/zod-openapi";

export const ApiKeyHiddenSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  keyFormat: z.string(),
  organizationId: z
    .string()
    .uuid()
    .nullable()
    .openapi({ description: "The organization the key acts in. Null for a key created before organizations, which acts in its owner's personal organization." }),
  projectId: z.string().uuid().nullable().openapi({ description: "The only project the key reaches, or null when it reaches every project its owner can." })
});

export const ApiKeyVisibleSchema = ApiKeyHiddenSchema.extend({
  apiKey: z.string()
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
    .optional(),
  projectId: z.string().uuid().optional().openapi({ description: "Limits the key to one project of the organization it is created in." })
});

export const UpdateApiKeySchema = z.object({
  name: z.string().optional()
});

export const FindApiKeyParamsSchema = z.object({
  id: z.string().uuid()
});

export const ListApiKeysResponseSchema = z.object({
  data: z.array(ApiKeyHiddenSchema)
});

export const ApiKeyVisibleResponseSchema = z.object({
  data: ApiKeyVisibleSchema
});

export const ApiKeyHiddenResponseSchema = z.object({
  data: ApiKeyHiddenSchema
});

export const CreateApiKeyRequestSchema = z.object({
  data: CreateApiKeySchema
});

export const UpdateApiKeyRequestSchema = z.object({
  data: UpdateApiKeySchema
});

export type ListApiKeysResponse = z.infer<typeof ListApiKeysResponseSchema>;
export type ApiKeyVisibleResponse = z.infer<typeof ApiKeyVisibleResponseSchema>;
export type ApiKeyHiddenResponse = z.infer<typeof ApiKeyHiddenResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeyRequestSchema>;
