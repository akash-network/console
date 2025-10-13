import { z } from "zod";

export const CreateJwtTokenRequestSchema = z.object({
  ttl: z.number().int().positive(),
  leases: z.record(z.string(), z.any())
});

export type CreateJwtTokenRequest = z.infer<typeof CreateJwtTokenRequestSchema>;

export const CreateJwtTokenResponseSchema = z.object({
  token: z.string()
});
export type CreateJwtTokenResponse = z.infer<typeof CreateJwtTokenResponseSchema>;
