import type { ApiKeyHttpService } from "@akashnetwork/http-sdk";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { QueryClient } from "@tanstack/react-query";
import { mock } from "jest-mock-extended";

import type { ContextType as WalletProviderContextType } from "@src/context/WalletProvider/WalletProvider";
import type { CustomUserProfile } from "@src/types/user";
import { USE_API_KEYS_DEPENDENCIES, useCreateApiKey, useDeleteApiKey, useUserApiKeys } from "./useApiKeysQuery";

import { act, waitFor } from "@testing-library/react";
import { buildApiKey, buildUser, buildWallet } from "@tests/seeders";
import { setupQuery } from "@tests/unit/query-client";

const mockApiKeys = [buildApiKey({ id: "key-1", name: "Test Key 1" }), buildApiKey({ id: "key-2", name: "Test Key 2" })];

const mockUser: CustomUserProfile = buildUser();
const mockWallet: WalletProviderContextType = buildWallet();

describe("useApiKeysQuery", () => {
  describe("useUserApiKeys", () => {
    it("should be disabled when user is not provided", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
      });

      const { result } = setupApiKeysQuery({
        user: undefined,
        wallet: mockWallet,
        services: {
          apiKey: () => apiKeyService
        }
      });

      // Verify the service was not called since the query is disabled
      expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();

      // Verify the query data is undefined
      expect(result.current.query.data).toBeUndefined();

      // Verify the query is not in a loading or success state
      expect(result.current.query.isLoading).toBe(false);
      expect(result.current.query.isSuccess).toBe(false);
    });

    it("should return undefined and not fetch when user is trialing", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: jest.fn()
      });
      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: { ...mockWallet, isTrialing: true },
        services: {
          apiKey: () => apiKeyService
        }
      });

      expect(result.current.query.fetchStatus).toBe("idle");
      expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();
      expect(result.current.query.data).toBeUndefined();
    });

    it("should return undefined and not fetch when wallet is not managed", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: jest.fn()
      });
      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: { ...mockWallet, isManaged: false },
        services: {
          apiKey: () => apiKeyService
        }
      });

      expect(result.current.query.fetchStatus).toBe("idle");
      expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();
      expect(result.current.query.data).toBeUndefined();
    });

    it("should fetch API keys when user is valid and wallet is managed", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
      });

      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: mockWallet,
        services: {
          apiKey: () => apiKeyService
        }
      });

      await waitFor(() => {
        expect(result.current.query.isSuccess).toBe(true);
      });

      expect(apiKeyService.getApiKeys).toHaveBeenCalled();
      expect(result.current.query.data).toEqual(mockApiKeys);
    });

    it("should use the correct query key", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
      });

      const queryClient = new QueryClient();
      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: mockWallet,
        services: {
          apiKey: () => apiKeyService,
          queryClient: () => queryClient
        }
      });

      await waitFor(() => {
        expect(result.current.query.isSuccess).toBe(true);
      });

      expect(result.current.query.data).toEqual(mockApiKeys);

      // Verify the query key in the cache
      const expectedQueryKey = ["API_KEYS", mockUser.userId];
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({ queryKey: expectedQueryKey });

      expect(queries).toHaveLength(1);
      expect(queries[0].queryKey).toEqual(expectedQueryKey);
    });
  });

  describe("useCreateApiKey", () => {
    it("should create API key successfully", async () => {
      const newApiKey = buildApiKey({ id: "new-key", name: "New Key" });
      const apiKeyService = mock<ApiKeyHttpService>({
        createApiKey: jest.fn().mockResolvedValue(newApiKey)
      });

      const queryClient = new QueryClient();
      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => ({
              user: mockUser,
              isLoading: false
            }),
            useWallet: () => mockWallet
          };
          return useCreateApiKey(dependencies);
        },
        {
          services: {
            apiKey: () => apiKeyService,
            queryClient: () => queryClient
          }
        }
      );

      act(() => {
        result.current.mutate("New Key");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiKeyService.createApiKey).toHaveBeenCalledWith({
        data: { name: "New Key" }
      });

      // Verify the cache is updated with the new API key
      const expectedQueryKey = ["API_KEYS", mockUser.userId];
      const cachedData = queryClient.getQueryData<ApiKeyResponse[]>(expectedQueryKey);
      expect(cachedData).toContainEqual(newApiKey);
    });
  });

  describe("useDeleteApiKey", () => {
    it("should delete API key successfully", async () => {
      const keyToDelete = buildApiKey({ id: "key-1", name: "Key to Delete" });
      const remainingKeys = [buildApiKey({ id: "key-2", name: "Remaining Key" })];
      const apiKeyService = mock<ApiKeyHttpService>({
        deleteApiKey: jest.fn().mockResolvedValue(undefined)
      });

      const queryClient = new QueryClient();
      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => ({
              user: mockUser,
              isLoading: false
            }),
            useWallet: () => mockWallet
          };
          return useDeleteApiKey("key-1", undefined, dependencies);
        },
        {
          services: {
            apiKey: () => apiKeyService,
            queryClient: () => {
              // Pre-seed the cache with the key to be deleted
              const expectedQueryKey = ["API_KEYS", mockUser.userId];
              queryClient.setQueryData(expectedQueryKey, [keyToDelete, ...remainingKeys]);
              return queryClient;
            }
          }
        }
      );

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiKeyService.deleteApiKey).toHaveBeenCalledWith("key-1");

      // Verify the cache is updated and the key is removed
      const expectedQueryKey = ["API_KEYS", mockUser.userId];
      const cachedData = queryClient.getQueryData<ApiKeyResponse[]>(expectedQueryKey);
      expect(cachedData).toEqual(remainingKeys);
      expect(cachedData).not.toContainEqual(keyToDelete);
    });

    it("should call onSuccess callback when deletion succeeds", async () => {
      const onSuccess = jest.fn();
      const apiKeyService = mock<ApiKeyHttpService>({
        deleteApiKey: jest.fn().mockResolvedValue(undefined)
      });

      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => ({
              user: mockUser,
              isLoading: false
            }),
            useWallet: () => mockWallet
          };
          return useDeleteApiKey("key-1", onSuccess, dependencies);
        },
        {
          services: {
            apiKey: () => apiKeyService
          }
        }
      );

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  function setupApiKeysQuery(input?: { user?: CustomUserProfile | undefined; wallet?: WalletProviderContextType; services?: Record<string, () => unknown> }) {
    const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
      ...USE_API_KEYS_DEPENDENCIES,
      useUser: () => ({
        user: input?.user as CustomUserProfile,
        isLoading: false
      }),
      useWallet: () => input?.wallet || mockWallet
    };

    return setupQuery(
      () => {
        return {
          query: useUserApiKeys({}, dependencies),
          dependencies
        };
      },
      {
        services: {
          apiKey: () => mock<ApiKeyHttpService>(),
          ...input?.services
        }
      }
    );
  }
});
