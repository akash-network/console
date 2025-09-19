import { useCallback } from "react";
import { isHttpError } from "@akashnetwork/http-sdk";
import type { AxiosError } from "axios";
import { atom, useAtom, useStore } from "jotai";
import { useAtomCallback } from "jotai/utils";

import { useServices } from "@src/context/ServicesProvider";
import { useWhen } from "@src/hooks/useWhen";

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

const userStateAtom = atom<AnonymousUserState>({
  isLoading: false
});

/** @private for tests only */
export const DEFAULT_RETRY_AFTER_SECONDS = 60 * 60;

export function useAnonymousUserQuery(id?: string, options?: { enabled?: boolean }): AnonymousUserState {
  const store = useStore();
  const { user: userService, errorHandler } = useServices();
  const [userState] = useAtom(userStateAtom);

  const fetchAnonymousUser = useAtomCallback(
    useCallback(
      async (get, set) => {
        if (get(userStateAtom).isLoading) return;
        try {
          set(userStateAtom, { isLoading: true });
          const { data: fetched, ...rest } = await userService.getOrCreateAnonymousUser(id);
          const token = "token" in rest ? rest.token : undefined;
          set(userStateAtom, { user: fetched, token, isLoading: false });
        } catch (error: any) {
          const retryAfterInSeconds =
            isHttpError(error) && error.response?.status === 429 ? error.response.data.retryAfter || DEFAULT_RETRY_AFTER_SECONDS : 10_000;
          set(userStateAtom, { isLoading: false, error, retryAfter: new Date(Date.now() + retryAfterInSeconds * 1000) });
          errorHandler.reportError({ error, tags: { category: "anonymousUserQuery" } });
        }
      },
      [id, userService, errorHandler]
    ),
    { store }
  );

  useWhen(
    options?.enabled && !userState.user && !userState.isLoading && (!userState.retryAfter || userState.retryAfter.getTime() < Date.now()),
    fetchAnonymousUser
  );

  return userState;
}

export interface AnonymousUserState {
  user?: UserOutput;
  isLoading: boolean;
  token?: string;
  error?: Error | AxiosError;
  retryAfter?: Date;
}
