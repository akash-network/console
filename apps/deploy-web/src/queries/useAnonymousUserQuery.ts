import { useMemo } from "react";
import { useMutation } from "react-query";
import axios from "axios";

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

const upsertApiUser = async (id?: string) => (await (id ? anonymousUsersHttp.get<ApiUserOutput>(id) : anonymousUsersHttp.post<ApiUserOutput>(""))).data;

export function useAnonymousUserQuery(id?: string) {
  const { mutate, data, isLoading, error } = useMutation(["User", id], async () => await upsertApiUser(id));
  return useMemo(() => ({ findOrCreate: mutate, data, isLoading, error }), [mutate, data, isLoading, error]);
}
