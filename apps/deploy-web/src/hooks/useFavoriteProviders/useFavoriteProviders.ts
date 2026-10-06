"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = { useServices, useQueryClient };

/** The api keeps at most this many and refuses a request that would go past it. */
export const MAX_FAVORITE_PROVIDERS = 500;

/** Changes to the list run one at a time, so each answer is the account's list after every change sent before it. */
const FAVORITES_CHANGES = { id: "favorite-providers" };
const NO_FAVORITES: string[] = [];

interface FavoriteProvidersResponse {
  data: { providerAddresses: string[] };
}

/** Moves the favorites this browser still holds to the account the first time it runs, so a user who starred providers before keeps them. */
export function useFavoriteProviders(dependencies = DEPENDENCIES) {
  const { api, browserFavoriteProviders } = dependencies.useServices();
  const queryClient = dependencies.useQueryClient();
  const queryKey = useMemo(() => api.v1.listFavoriteProviders.getKey(), [api]);
  const { data } = api.v1.listFavoriteProviders.useQuery(undefined, { select: response => response.data.providerAddresses });
  const favoriteProviders = data ?? NO_FAVORITES;
  const hasStartedMoveRef = useRef(false);

  /** Takes only the last queued change's answer, since an earlier one would hide the changes behind it, and drops any read it would otherwise land under. */
  const takeTheAccountList = useCallback(
    async (response: FavoriteProvidersResponse) => {
      await queryClient.cancelQueries({ queryKey });
      const changesNotAnswered = queryClient.isMutating({ predicate: mutation => mutation.options.scope?.id === FAVORITES_CHANGES.id });
      if (changesNotAnswered <= 1) queryClient.setQueryData(queryKey, response);
    },
    [queryClient, queryKey]
  );
  const rereadTheAccountList = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  const { mutate: addFavorites } = api.v1.createFavoriteProviders.useMutation({
    scope: FAVORITES_CHANGES,
    onSuccess: takeTheAccountList,
    onError: rereadTheAccountList
  });
  const { mutate: removeFavorite } = api.v1.deleteFavoriteProvider.useMutation({
    scope: FAVORITES_CHANGES,
    onSuccess: takeTheAccountList,
    onError: rereadTheAccountList
  });
  /** Forgets them in the mutation's own callback, which still runs when the page that started the move is gone by the time it lands. */
  const { mutate: moveBrowserFavorites } = api.v1.createFavoriteProviders.useMutation({
    scope: FAVORITES_CHANGES,
    onSuccess: response => {
      browserFavoriteProviders.forget();
      return takeTheAccountList(response);
    },
    onError: rereadTheAccountList
  });

  useEffect(
    function moveBrowserFavoritesToTheAccount() {
      if (hasStartedMoveRef.current) return;
      hasStartedMoveRef.current = true;

      const browserFavorites = browserFavoriteProviders.read().slice(0, MAX_FAVORITE_PROVIDERS);
      if (browserFavorites.length === 0) {
        browserFavoriteProviders.forget();
        return;
      }

      moveBrowserFavorites({ data: { providerAddresses: browserFavorites } });
    },
    [browserFavoriteProviders, moveBrowserFavorites]
  );

  const toggleFavorite = useCallback(
    (owner: string) => {
      const isFavorite = favoriteProviders.includes(owner);
      const providerAddresses = isFavorite ? favoriteProviders.filter(favorite => favorite !== owner) : [...favoriteProviders, owner];
      void queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, { data: { providerAddresses } });

      if (isFavorite) {
        removeFavorite({ providerAddress: owner });
      } else {
        addFavorites({ data: { providerAddresses: [owner] } });
      }
    },
    [favoriteProviders, queryClient, queryKey, addFavorites, removeFavorite]
  );

  return { favoriteProviders, toggleFavorite };
}
