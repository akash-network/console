import type { ApiKeyHttpService } from "@akashnetwork/http-sdk/src/api-key/api-key-http.service";
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
    it("should return null when user is not provided", async () => {
      const { result } = setupApiKeysQuery({
        user: undefined,
        wallet: mockWallet
      });

      await waitFor(() => {
        expect(result.current.query.data).toBeUndefined();
      });
    });

    it("should return null when user is trialing", async () => {
      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: { ...mockWallet, isTrialing: true }
      });

      await waitFor(() => {
        expect(result.current.query.data).toBeUndefined();
      });
    });

    it("should return null when wallet is not managed", async () => {
      const { result } = setupApiKeysQuery({
        user: mockUser,
        wallet: { ...mockWallet, isManaged: false }
      });

      await waitFor(() => {
        expect(result.current.query.data).toBeUndefined();
      });
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

      expect(result.current.query.data).toEqual(mockApiKeys);
    });
  });

  describe("useCreateApiKey", () => {
    it("should create API key successfully", async () => {
      const newApiKey = buildApiKey({ id: "new-key", name: "New Key" });
      const apiKeyService = mock<ApiKeyHttpService>({
        createApiKey: jest.fn().mockResolvedValue(newApiKey)
      });

      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => mockUser,
            useWallet: () => mockWallet
          };
          return useCreateApiKey(dependencies);
        },
        {
          services: {
            apiKey: () => apiKeyService
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
    });
  });

  describe("useDeleteApiKey", () => {
    it("should delete API key successfully", async () => {
      const apiKeyService = mock<ApiKeyHttpService>({
        deleteApiKey: jest.fn().mockResolvedValue(undefined)
      });

      const { result } = setupQuery(
        () => {
          const dependencies: typeof USE_API_KEYS_DEPENDENCIES = {
            ...USE_API_KEYS_DEPENDENCIES,
            useUser: () => mockUser,
            useWallet: () => mockWallet
          };
          return useDeleteApiKey("key-1", undefined, dependencies);
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

      expect(apiKeyService.deleteApiKey).toHaveBeenCalledWith("key-1");
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
            useUser: () => mockUser,
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
      useUser: () => input?.user as CustomUserProfile,
      useWallet: () => input?.wallet || mockWallet
    };

    return setupQuery(
      () => ({
        query: useUserApiKeys({}, dependencies),
        dependencies
      }),
      {
        services: {
          apiKey: () => mock<ApiKeyHttpService>(),
          ...input?.services
        }
      }
    );
  }
});
