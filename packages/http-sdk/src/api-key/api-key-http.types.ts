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

export const CreateApiKeyRequestSchema = z.object({
  data: CreateApiKeySchema
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type ListApiKeys = z.infer<typeof ListApiKeysSchema>;
