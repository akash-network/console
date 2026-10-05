import { z } from "@hono/zod-openapi";

export const InitiateAccountDeletionRequestSchema = z.object({
  data: z.object({
    forfeitAcknowledged: z.boolean()
  })
});

export type InitiateAccountDeletionRequest = z.infer<typeof InitiateAccountDeletionRequestSchema>;

export const ConfirmAccountDeletionRequestSchema = z.object({
  data: z.object({
    token: z.string().min(1).max(256)
  })
});

export type ConfirmAccountDeletionRequest = z.infer<typeof ConfirmAccountDeletionRequestSchema>;
