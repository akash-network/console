import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useWalletSettingsMutations, useWalletSettingsQuery } from "./useWalletSettingsQueries";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

function setupQueryWithClient<T>(hook: () => T, options?: RenderAppHookOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    }
  });

  const hookResult = setupQuery(hook, {
    ...options,
    services: {
      ...options?.services,
      queryClient: () => queryClient
    }
  });

  return { ...hookResult, queryClient };
}

describe("useWalletSettingsQueries", () => {
  describe(useWalletSettingsQuery.name, () => {
    it("returns wallet settings data on success", async () => {
      const settings = { autoReloadEnabled: true };
      const getWalletSettings = vi.fn().mockResolvedValue({ data: settings });
      const api = createProxy({ v1: { getWalletSettings } }) as unknown as ApiService;

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { api: () => api }
      });

      await vi.waitFor(() => {
        expect(getWalletSettings).toHaveBeenCalled();
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(settings);
      });
    });

    it("returns null when wallet settings are not found", async () => {
      const getWalletSettings = vi.fn().mockRejectedValue(new ApiError(404, undefined, "GET /v1/wallet-settings → 404"));
      const api = createProxy({ v1: { getWalletSettings } }) as unknown as ApiService;

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { api: () => api }
      });

      await vi.waitFor(() => {
        expect(getWalletSettings).toHaveBeenCalled();
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toBeNull();
      });
    });

    it("rethrows non-404 errors", async () => {
      const getWalletSettings = vi.fn().mockRejectedValue(new ApiError(500, undefined, "GET /v1/wallet-settings → 500"));
      const api = createProxy({ v1: { getWalletSettings } }) as unknown as ApiService;

      const { result } = setupQuery(() => useWalletSettingsQuery(), {
        services: { api: () => api }
      });

      await vi.waitFor(() => {
        expect(getWalletSettings).toHaveBeenCalled();
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe(useWalletSettingsMutations.name, () => {
    it("updates wallet settings and invalidates the query", async () => {
      const params = { data: { autoReloadEnabled: true } };
      const { result, queryClient, api, v1 } = setupMutations();
      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      await act(async () => {
        await result.current.updateWalletSettings.mutateAsync(params);
      });

      await vi.waitFor(() => {
        expect(v1.updateWalletSettings).toHaveBeenCalledWith(params);
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: api.v1.getWalletSettings.getKey() });
      });
    });

    it("creates wallet settings and invalidates the query", async () => {
      const params = { data: { autoReloadEnabled: true } };
      const { result, queryClient, api, v1 } = setupMutations();
      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      await act(async () => {
        await result.current.createWalletSettings.mutateAsync(params);
      });

      await vi.waitFor(() => {
        expect(v1.createWalletSettings).toHaveBeenCalledWith(params);
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: api.v1.getWalletSettings.getKey() });
      });
    });

    it("deletes wallet settings and invalidates the query", async () => {
      const { result, queryClient, api, v1 } = setupMutations();
      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      await act(async () => {
        await result.current.deleteWalletSettings.mutateAsync();
      });

      await vi.waitFor(() => {
        expect(v1.deleteWalletSettings).toHaveBeenCalled();
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: api.v1.getWalletSettings.getKey() });
      });
    });

    function setupMutations() {
      const v1 = {
        getWalletSettings: vi.fn(),
        updateWalletSettings: vi.fn().mockResolvedValue(undefined),
        createWalletSettings: vi.fn().mockResolvedValue(undefined),
        deleteWalletSettings: vi.fn().mockResolvedValue(undefined)
      };
      const api = createProxy({ v1 }) as unknown as ApiService;
      const { result, queryClient } = setupQueryWithClient(() => useWalletSettingsMutations(), {
        services: { api: () => api }
      });
      return { result, queryClient, api, v1 };
    }
  });
});
