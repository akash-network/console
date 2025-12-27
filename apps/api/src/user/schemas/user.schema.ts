import { z } from "zod";

export const GetUserResponseOutputSchema = z.object({
  data: z
    .object({
      id: z.string().openapi({})
    })
    .openapi({})
});

export type GetUserResponseOutput = z.infer<typeof GetUserResponseOutputSchema>;

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
  githubUsername: z.string().optional().nullable()
});

export type UserSchema = z.infer<typeof UserSchema>;
