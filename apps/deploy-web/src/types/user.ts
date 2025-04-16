import type { UserProfile } from "@auth0/nextjs-auth0/client";

import type { IPlan, PlanCode } from "@src/utils/plans";

export interface UserSettings {
  id?: string;
  userId?: string;
  username?: string;
  subscribedToNewsletter?: boolean;
  bio?: string;
  youtubeUsername?: string;
  twitterUsername?: string;
  githubUsername?: string;
  planCode?: PlanCode;
  plan?: IPlan;
}

export type CustomUserProfile = UserProfile & UserSettings;

export interface IUserSetting {
  username: string;
  bio: string;
}
