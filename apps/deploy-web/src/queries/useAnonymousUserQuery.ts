import { useState } from "react";

import { useWhen } from "@src/hooks/useWhen";
import { userHttpService } from "@src/services/user-http/user-http.service";

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
  const [userState, setUserState] = useState<{ user?: UserOutput; isLoading: boolean }>({ isLoading: !!options?.enabled });

  useWhen(options?.enabled && !userState.user, async () => {
    const fetched = await userHttpService.getOrCreateAnonymousUser(id);
    setUserState({ user: fetched, isLoading: false });
  });

  return userState;
}
