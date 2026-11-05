import { z } from "@hono/zod-openapi";

import { MAX_CONSENT_COPY_VERSION_LENGTH } from "@src/feedback/model-schemas/assistant-consent/assistant-consent.schema";

const AssistantPrivacySchema = z.object({
  consent: z
    .object({
      copyVersion: z.string(),
      processingAcceptedAt: z.string().datetime().openapi({ description: "When the user agreed to this copy version" }),
      reviewOptIn: z.boolean(),
      updatedAt: z.string().datetime()
    })
    .nullable()
    .openapi({ description: "The latest consent, or null when the user never agreed" }),
  storedConversationCount: z.number().int().nonnegative()
});

export const AssistantPrivacyResponseSchema = z.object({
  data: AssistantPrivacySchema
});

export const UpdateAssistantConsentRequestSchema = z.object({
  data: z.object({
    copyVersion: z.string().trim().min(1).max(MAX_CONSENT_COPY_VERSION_LENGTH).openapi({ description: "The version of the consent copy the user agreed to" }),
    reviewOptIn: z.boolean().openapi({ description: "Whether the Akash team may review the user's conversations" })
  })
});

export const DeleteAssistantConversationsResponseSchema = z.object({
  data: z.object({
    deletedCount: z.number().int().nonnegative()
  })
});

export type AssistantPrivacy = z.infer<typeof AssistantPrivacySchema>;
export type AssistantPrivacyResponse = z.infer<typeof AssistantPrivacyResponseSchema>;
export type UpdateAssistantConsentRequest = z.infer<typeof UpdateAssistantConsentRequestSchema>;
export type DeleteAssistantConversationsResponse = z.infer<typeof DeleteAssistantConversationsResponseSchema>;
