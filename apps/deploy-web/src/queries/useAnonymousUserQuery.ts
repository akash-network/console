import { useState } from "react";
import axios from "axios";

import { useWhen } from "@src/hooks/useWhen";
import { BASE_API_URL } from "@src/utils/constants";

export interface ApiUserOutput {
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

export const anonymousUsersHttp = axios.create({
  baseURL: `${BASE_API_URL}/v1/anonymous-users`
});

const createAnonymousUser = async () => (await anonymousUsersHttp.post<ApiUserOutput>("")).data;
const getAnonymousUser = async (id: string) => (await anonymousUsersHttp.get<ApiUserOutput>(id)).data;

let userAsPromised: Promise<ApiUserOutput>;
const findOrCreateAnonymousUser = async (id?: string) => {
  userAsPromised = userAsPromised || (id ? getAnonymousUser(id) : createAnonymousUser());
  return await userAsPromised;
};

export function useAnonymousUserQuery(id?: string, options?: { enabled?: boolean }) {
  const [userState, setUserState] = useState<{ user?: ApiUserOutput; isLoading: boolean }>({ isLoading: !!options?.enabled });

  useWhen(options?.enabled && !userState.user, async () => {
    const fetched = await findOrCreateAnonymousUser(id);
    setUserState({ user: fetched, isLoading: false });
  });

  return userState;
}
