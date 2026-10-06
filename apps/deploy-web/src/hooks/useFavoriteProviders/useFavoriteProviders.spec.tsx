import { StrictMode } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BrowserFavoriteProvidersService } from "@src/services/browser-favorite-providers/browser-favorite-providers.service";
import type { DEPENDENCIES } from "./useFavoriteProviders";
import { MAX_FAVORITE_PROVIDERS, useFavoriteProviders } from "./useFavoriteProviders";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;
type Answer = { data: { providerAddresses: string[] } };

describe(useFavoriteProviders.name, () => {
  it("lists the account's favorites", async () => {
    const { result } = setup({ accountFavorites: ["akash1kept"] });

    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));
  });

  it("lists no favorite while the account's are still being read", () => {
    const { result } = setup({ accountFavorites: ["akash1kept"], isListAnsweredByHand: true });

    expect(result.current.favoriteProviders).toEqual([]);
  });

  it("moves the browser's favorites to the account once, then forgets them", async () => {
    const { result, createFavoriteProviders, browserFavoriteProviders, rerender } = setup({
      accountFavorites: ["akash1kept"],
      browserFavorites: ["akash1browser"]
    });

    await waitFor(() => expect(browserFavoriteProviders.forget).toHaveBeenCalledTimes(1));
    rerender();

    expect(createFavoriteProviders).toHaveBeenCalledTimes(1);
    expect(createFavoriteProviders).toHaveBeenCalledWith({ data: { providerAddresses: ["akash1browser"] } });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1browser"]));
  });

  it("keeps the moved favorites when the account's list, read before the move, answers after it", async () => {
    const { result, browserFavoriteProviders, answerList, cachedFavorites } = setup({
      accountFavorites: [],
      browserFavorites: ["akash1browser"],
      isListAnsweredByHand: true
    });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1browser"]));

    await act(async () => answerList(0, []));

    expect(cachedFavorites()).toEqual(["akash1browser"]);
    expect(browserFavoriteProviders.forget).toHaveBeenCalledTimes(1);
  });

  it("moves the browser's favorites once when the effect runs twice", async () => {
    const { createFavoriteProviders, browserFavoriteProviders } = setup({ accountFavorites: [], browserFavorites: ["akash1browser"], isStrict: true });

    await waitFor(() => expect(browserFavoriteProviders.forget).toHaveBeenCalledTimes(1));
    expect(createFavoriteProviders).toHaveBeenCalledTimes(1);
  });

  it("keeps the browser's favorites when the account refuses them, and reads its list again", async () => {
    const { browserFavoriteProviders, listFavoriteProviders } = setup({
      accountFavorites: ["akash1kept"],
      browserFavorites: ["akash1browser"],
      createFailure: new ApiError(500, undefined, "POST /v1/favorite-providers → 500")
    });

    await waitFor(() => expect(listFavoriteProviders).toHaveBeenCalledTimes(2));
    expect(browserFavoriteProviders.forget).not.toHaveBeenCalled();
  });

  it("forgets an empty browser list without asking the account to add anything", () => {
    const { createFavoriteProviders, browserFavoriteProviders } = setup({ accountFavorites: [], browserFavorites: [] });

    expect(browserFavoriteProviders.forget).toHaveBeenCalledTimes(1);
    expect(createFavoriteProviders).not.toHaveBeenCalled();
  });

  it("moves no more favorites than the account keeps", async () => {
    const browserFavorites = Array.from({ length: MAX_FAVORITE_PROVIDERS + 1 }, (_, index) => `akash1favorite${index}`);
    const { createFavoriteProviders } = setup({ accountFavorites: [], browserFavorites });

    await waitFor(() =>
      expect(createFavoriteProviders).toHaveBeenCalledWith({ data: { providerAddresses: browserFavorites.slice(0, MAX_FAVORITE_PROVIDERS) } })
    );
  });

  it("stars a provider before the account answers, then takes the answer", async () => {
    const { result, createFavoriteProviders, answer } = setup({ accountFavorites: ["akash1kept"], isAnsweredByHand: true });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));

    act(() => result.current.toggleFavorite("akash1new"));

    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1new"]));
    await waitFor(() => expect(createFavoriteProviders).toHaveBeenCalledWith({ data: { providerAddresses: ["akash1new"] } }));
    act(() => answer(0, ["akash1new", "akash1kept"]));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1new", "akash1kept"]));
  });

  it("unstars a favorite before the account answers, then takes the answer", async () => {
    const { result, deleteFavoriteProvider, answer } = setup({ accountFavorites: ["akash1kept", "akash1gone"], isAnsweredByHand: true });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1gone"]));

    act(() => result.current.toggleFavorite("akash1gone"));

    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));
    await waitFor(() => expect(deleteFavoriteProvider).toHaveBeenCalledWith({ providerAddress: "akash1gone" }));
    act(() => answer(0, ["akash1kept", "akash1other"]));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1other"]));
  });

  it("reads the account's list again when a star does not land", async () => {
    const { result, listFavoriteProviders } = setup({
      accountFavorites: ["akash1kept"],
      createFailure: new ApiError(500, undefined, "POST /v1/favorite-providers → 500")
    });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));

    act(() => result.current.toggleFavorite("akash1new"));

    await waitFor(() => expect(listFavoriteProviders).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));
  });

  it("sends a star only once the one before it is answered, and keeps it shown meanwhile", async () => {
    const { result, createFavoriteProviders, answer } = setup({ accountFavorites: [], isAnsweredByHand: true });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual([]));

    act(() => result.current.toggleFavorite("akash1first"));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1first"]));
    act(() => result.current.toggleFavorite("akash1second"));
    await waitFor(() => expect(createFavoriteProviders).toHaveBeenCalledTimes(1));

    act(() => answer(0, ["akash1first"]));
    await waitFor(() => expect(createFavoriteProviders).toHaveBeenCalledTimes(2));
    expect(result.current.favoriteProviders).toEqual(["akash1first", "akash1second"]);

    act(() => answer(1, ["akash1first", "akash1second", "akash1elsewhere"]));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1first", "akash1second", "akash1elsewhere"]));
  });

  it("takes the account's answer while a change unrelated to favorites is still pending", async () => {
    const { result, answer, queryClient } = setup({ accountFavorites: ["akash1kept"], isAnsweredByHand: true });
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept"]));
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => new Promise(() => undefined) })
      .execute(undefined);

    act(() => result.current.toggleFavorite("akash1new"));
    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1new"]));
    act(() => answer(0, ["akash1kept", "akash1new", "akash1elsewhere"]));

    await waitFor(() => expect(result.current.favoriteProviders).toEqual(["akash1kept", "akash1new", "akash1elsewhere"]));
  });

  function setup(input: {
    accountFavorites: string[];
    browserFavorites?: string[];
    createFailure?: Error;
    isAnsweredByHand?: boolean;
    isListAnsweredByHand?: boolean;
    isStrict?: boolean;
  }) {
    let accountFavorites = [...input.accountFavorites];
    const answerOf = (): Answer => ({ data: { providerAddresses: [...accountFavorites] } });
    const pendingAnswers: ((answer: Answer) => void)[] = [];
    const answeredByHand = () => new Promise<Answer>(resolve => pendingAnswers.push(resolve));

    const pendingListAnswers: ((answer: Answer) => void)[] = [];
    const listFavoriteProviders = vi.fn(() =>
      input.isListAnsweredByHand ? new Promise<Answer>(resolve => pendingListAnswers.push(resolve)) : Promise.resolve(answerOf())
    );
    const createFavoriteProviders = vi.fn(({ data }: { data: { providerAddresses: string[] } }) => {
      if (input.createFailure) return Promise.reject(input.createFailure);
      if (input.isAnsweredByHand) return answeredByHand();

      accountFavorites = [...accountFavorites, ...data.providerAddresses.filter(address => !accountFavorites.includes(address))];
      return Promise.resolve(answerOf());
    });
    const deleteFavoriteProvider = vi.fn(({ providerAddress }: { providerAddress: string }) => {
      if (input.isAnsweredByHand) return answeredByHand();
      accountFavorites = accountFavorites.filter(address => address !== providerAddress);
      return Promise.resolve(answerOf());
    });
    const api = createProxy({ v1: { listFavoriteProviders, createFavoriteProviders, deleteFavoriteProvider } }) as unknown as ApiService;
    const browserFavoriteProviders = mock<BrowserFavoriteProvidersService>({ read: vi.fn(() => input.browserFavorites ?? []) });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    /** `satisfies` type-checks the fields against the real container, but `api` is a recursive proxy that `mock<T>()` recurses into until the heap dies. */
    const services = { api, browserFavoriteProviders } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => queryClient;

    const view = setupQuery(() => useFavoriteProviders({ useServices, useQueryClient }), {
      services: { api: () => api, queryClient: () => queryClient },
      ...(input.isStrict ? { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> } : {})
    });
    const answer = (index: number, providerAddresses: string[]) => pendingAnswers[index]({ data: { providerAddresses } });
    const answerList = (index: number, providerAddresses: string[]) => pendingListAnswers[index]({ data: { providerAddresses } });
    const cachedFavorites = () => queryClient.getQueryData<Answer>(api.v1.listFavoriteProviders.getKey())?.data.providerAddresses;

    return {
      ...view,
      listFavoriteProviders,
      createFavoriteProviders,
      deleteFavoriteProvider,
      browserFavoriteProviders,
      answer,
      answerList,
      cachedFavorites,
      queryClient
    };
  }
});
