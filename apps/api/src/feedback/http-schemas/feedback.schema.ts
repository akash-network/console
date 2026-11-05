import { z } from "@hono/zod-openapi";

import {
  feedbackCategoryEnum,
  feedbackDeploymentOutcomeEnum,
  MAX_DSEQ_LENGTH,
  MAX_FEEDBACK_MESSAGE_LENGTH
} from "@src/feedback/model-schemas/feedback-submission/feedback-submission.schema";

const MAX_PAGE_LENGTH = 500;
const MAX_FAILURE_REASON_LENGTH = 1000;
const MIN_RATING = 1;
const MAX_RATING = 5;

const DseqSchema = z
  .string()
  .regex(new RegExp(`^\\d{1,${MAX_DSEQ_LENGTH}}$`))
  .openapi({ example: "21434557" });

const PageSchema = z.string().trim().max(MAX_PAGE_LENGTH).optional().openapi({ description: "The Console page the feedback was sent from" });

const DeploymentOutcomeFeedbackSchema = z.object({
  kind: z.literal("deployment_outcome"),
  dseq: DseqSchema,
  outcome: z.enum(feedbackDeploymentOutcomeEnum.enumValues),
  dismissed: z.boolean().default(false).openapi({ description: "The user closed the prompt without answering; it still counts as an answer" }),
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING).optional(),
  message: z.string().trim().max(MAX_FEEDBACK_MESSAGE_LENGTH).optional(),
  failureReason: z.string().trim().max(MAX_FAILURE_REASON_LENGTH).optional(),
  page: PageSchema
});

const GeneralFeedbackSchema = z.object({
  kind: z.literal("general"),
  category: z.enum(feedbackCategoryEnum.enumValues),
  message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  page: PageSchema
});

const FeedbackInputSchema = z.discriminatedUnion("kind", [DeploymentOutcomeFeedbackSchema, GeneralFeedbackSchema]).superRefine((input, ctx) => {
  if (input.kind !== "deployment_outcome") return;

  if (input.dismissed && (input.rating !== undefined || input.message)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dismissed"], message: "A dismissed prompt carries no rating or message" });
  }

  if (!input.dismissed && input.rating === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rating"], message: "A rating is required unless the prompt was dismissed" });
  }
});

export const CreateFeedbackRequestSchema = z.object({
  data: FeedbackInputSchema
});

export const CreateFeedbackResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    createdAt: z.string().datetime()
  })
});

export const FeedbackOutcomePromptParamsSchema = z.object({
  dseq: DseqSchema
});

export const FeedbackOutcomePromptResponseSchema = z.object({
  data: z.object({
    dseq: z.string(),
    eligible: z.boolean(),
    reason: z.enum(["already_answered", "cooldown"]).nullable().openapi({ description: "Why the prompt should not be shown, or null when it should" })
  })
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
export type CreateFeedbackRequest = z.infer<typeof CreateFeedbackRequestSchema>;
export type CreateFeedbackResponse = z.infer<typeof CreateFeedbackResponseSchema>;
export type FeedbackOutcomePromptResponse = z.infer<typeof FeedbackOutcomePromptResponseSchema>;
export type FeedbackOutcomePrompt = FeedbackOutcomePromptResponse["data"];
