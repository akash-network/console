import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";

import { useWhen } from "@src/hooks/useWhen";
import { userHttpService } from "@src/services/http/http-browser.service";

export interface UserOutput {
  id: string;
  userId?: string;
  username?: string;
  email?: string;
  emailVerified: boolean;
  stripeCustomerId?: string;
  bio?: string;
  subscribedToNewsletter: boolean;
  youtubeUsername?: string;
  twitterUsername?: string;
  githubUsername?: string;
}

export function useAnonymousUserQuery(id?: string, options?: { enabled?: boolean }) {
  const [userState, setUserState] = useState<{ user?: UserOutput; isLoading: boolean; token?: string; error?: Error | AxiosError }>({
    isLoading: !!options?.enabled
  });

  useWhen(options?.enabled && !userState.user, async () => {
    try {
      const { data: fetched, ...rest } = await userHttpService.getOrCreateAnonymousUser(id);
      const token = "token" in rest ? rest.token : undefined;
      setUserState({ user: fetched, token, isLoading: false });
    } catch (error) {
      setUserState({ isLoading: false, error: error as Error | AxiosError });
      Sentry.captureException(error);
    }
  });

  return userState;
}
