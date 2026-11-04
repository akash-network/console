import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  stripeCustomerId: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  subscribedToNewsletter: z.boolean(),
  youtubeUsername: z.string().optional().nullable(),
  twitterUsername: z.string().optional().nullable(),
  githubUsername: z.string().optional().nullable(),
  onboardingSkippedAt: z.string().datetime().nullable().optional(),
  fairUsePolicyAcceptedAt: z.string().datetime().nullable().optional(),
  productUpdatesUnsubscribedAt: z.string().datetime().nullable().optional(),
  getStartedDismissedAt: z.string().datetime().nullable().optional(),
  agentSetupCopiedAt: z.string().datetime().nullable().optional(),
  githubStarPromptedAt: z.string().datetime().nullable().optional(),
  timezone: z.string().nullable().optional().openapi({ description: "IANA timezone the dates in the user's emails are shown in, UTC when unknown" })
});

export type UserSchema = z.infer<typeof UserSchema>;

export const CurrentUserSchema = UserSchema.extend({
  createdAt: z.string().datetime().nullable()
});

export type CurrentUserSchema = z.infer<typeof CurrentUserSchema>;

export const GetUserResponseOutputSchema = z.object({
  data: CurrentUserSchema.openapi({})
});

export type GetUserResponseOutput = z.infer<typeof GetUserResponseOutputSchema>;
