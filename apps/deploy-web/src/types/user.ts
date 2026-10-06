import type { UserProfile } from "@auth0/nextjs-auth0/client";

import type { IPlan, PlanCode } from "@src/utils/plans";

export interface UserSettings {
  id?: string;
  userId?: string;
  username?: string;
  subscribedToNewsletter?: boolean;
  bio?: string | null;
  youtubeUsername?: string | null;
  twitterUsername?: string | null;
  githubUsername?: string | null;
  planCode?: PlanCode;
  plan?: IPlan;
  emailVerified?: boolean;
  onboardingSkippedAt?: string | null;
  fairUsePolicyAcceptedAt?: string | null;
  productUpdatesUnsubscribedAt?: string | null;
}

export type CustomUserProfile = UserProfile & UserSettings;

export interface IUserSetting {
  username: string;
  bio: string;
}
