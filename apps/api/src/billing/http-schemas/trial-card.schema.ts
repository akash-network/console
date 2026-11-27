import { z } from "@hono/zod-openapi";

export const TrialCardResponseSchema = z.object({
  data: z.object({
    step: z.enum(["not_required", "required", "verified"]).openapi({
      description:
        "`required` when the caller's free trial waits for a card, `verified` once a card started it, `not_required` for everyone else, including accounts refused a trial."
    })
  })
});

export type TrialCardResponse = z.infer<typeof TrialCardResponseSchema>;

export const TrialCardSetupIntentResponseSchema = z.object({
  data: z.object({
    id: z.string().openapi({ description: "Sent back to confirm the card once Stripe has saved it." }),
    clientSecret: z.string().nullable()
  })
});

export type TrialCardSetupIntentResponse = z.infer<typeof TrialCardSetupIntentResponseSchema>;

export const ConfirmTrialCardRequestSchema = z.object({
  data: z.object({
    setupIntentId: z.string().min(1).max(255).openapi({ description: "The SetupIntent the card was saved with.", example: "seti_1PxyzAbCdEfGhIjKlMnOpQrS" })
  })
});

export type ConfirmTrialCardRequest = z.infer<typeof ConfirmTrialCardRequestSchema>;
