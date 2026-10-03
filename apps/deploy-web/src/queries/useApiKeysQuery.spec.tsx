import type { ApiKeyHttpService } from "@akashnetwork/http-sdk";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CustomUserProfile } from "@src/types/user";
import { USE_API_KEYS_DEPENDENCIES, useCreateApiKey, useDeleteApiKey, useUserApiKeys } from "./useApiKeysQuery";

import { act } from "@testing-library/react";
import { buildApiKey, buildUser } from "@tests/seeders";
import { setupQuery } from "@tests/unit/query-client";

const mockApiKeys = [buildApiKey({ id: "key-1", name: "Test Key 1" }), buildApiKey({ id: "key-2", name: "Test Key 2" })];

const mockUser: CustomUserProfile = buildUser();

describe("useApiKeysQuery", () => {
  describe("useUserApiKeys", () => {
    it("should be disabled when user is not provided", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: vi.fn().mockResolvedValue(mockApiKeys)
      });

      const { result } = setupApiKeysQuery({
        user: undefined,
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

    it("should fetch API keys when user is valid", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: vi.fn().mockResolvedValue(mockApiKeys)
      });

      const { result } = setupApiKeysQuery({
        user: mockUser,
        services: {
          apiKey: () => apiKeyService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.query.isSuccess).toBe(true);
      });

      expect(apiKeyService.getApiKeys).toHaveBeenCalled();
      expect(result.current.query.data).toEqual(mockApiKeys);
    });

    it("should use the correct query key", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        getApiKeys: vi.fn().mockResolvedValue(mockApiKeys)
      });

      const queryClient = new QueryClient();
      const { result } = setupApiKeysQuery({
        user: mockUser,
        services: {
          apiKey: () => apiKeyService,
          queryClient: () => queryClient
        }
      });

      await vi.waitFor(() => {
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
    it("creates the API key with its expiry and caches it without the secret", async () => {
      const newApiKey = buildApiKey({ id: "new-key", name: "New Key" });
      const expiresAt = new Date("2027-10-02T12:00:00.000Z");
      const apiKeyService = mock<ApiKeyHttpService>({
        createApiKey: vi.fn().mockResolvedValue({ ...newApiKey, apiKey: "ac.sk.test.secret" })
      });

      const queryClient = new QueryClient();
      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () =>
              mock<ReturnType<typeof USE_API_KEYS_DEPENDENCIES.useUser>>({
                user: mockUser,
                isLoading: false
              })
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
        result.current.mutate({ name: "New Key", expiresAt });
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiKeyService.createApiKey).toHaveBeenCalledWith({
        data: { name: "New Key", expiresAt }
      });

      const expectedQueryKey = ["API_KEYS", mockUser.userId];
      const cachedData = queryClient.getQueryData<ApiKeyResponse[]>(expectedQueryKey);
      expect(cachedData).toEqual([newApiKey]);
    });

    it("appends the created API key to the keys already cached", async () => {
      const existingKey = buildApiKey({ id: "existing-key" });
      const newApiKey = buildApiKey({ id: "new-key" });
      const apiKeyService = mock<ApiKeyHttpService>({
        createApiKey: vi.fn().mockResolvedValue({ ...newApiKey, apiKey: "ac.sk.test.secret" })
      });
      const queryClient = new QueryClient();
      queryClient.setQueryData(["API_KEYS", mockUser.userId], [existingKey]);

      const { result } = setupQuery(
        () =>
          useCreateApiKey({
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => mock<ReturnType<typeof USE_API_KEYS_DEPENDENCIES.useUser>>({ user: mockUser, isLoading: false })
          }),
        { services: { apiKey: () => apiKeyService, queryClient: () => queryClient } }
      );

      act(() => {
        result.current.mutate({ name: newApiKey.name, expiresAt: new Date("2027-10-02T12:00:00.000Z") });
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(queryClient.getQueryData<ApiKeyResponse[]>(["API_KEYS", mockUser.userId])).toEqual([existingKey, newApiKey]);
    });
  });

  describe("useDeleteApiKey", () => {
    it("should delete API key successfully", async () => {
      const keyToDelete = buildApiKey({ id: "key-1", name: "Key to Delete" });
      const remainingKeys = [buildApiKey({ id: "key-2", name: "Remaining Key" })];
      const apiKeyService = mock<ApiKeyHttpService>({
        deleteApiKey: vi.fn().mockResolvedValue(undefined)
      });

      const queryClient = new QueryClient();
      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () =>
              mock<ReturnType<typeof USE_API_KEYS_DEPENDENCIES.useUser>>({
                user: mockUser,
                isLoading: false
              })
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

      await vi.waitFor(() => {
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
      const onSuccess = vi.fn();
      const apiKeyService = mock<ApiKeyHttpService>({
        deleteApiKey: vi.fn().mockResolvedValue(undefined)
      });

      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () =>
              mock<ReturnType<typeof USE_API_KEYS_DEPENDENCIES.useUser>>({
                user: mockUser,
                isLoading: false
              })
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

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  function setupApiKeysQuery(input?: { user?: CustomUserProfile | undefined; services?: Record<string, () => unknown> }) {
    const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
      ...USE_API_KEYS_DEPENDENCIES,
      useUser: () =>
        mock<ReturnType<typeof USE_API_KEYS_DEPENDENCIES.useUser>>({
          user: input?.user as CustomUserProfile,
          isLoading: false
        })
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
