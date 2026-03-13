import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { ApiKeysPage, DEPENDENCIES } from "./ApiKeysPage";

import { act, render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ApiKeysPage.name, () => {
  it("passes api keys to ApiKeyList", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    const apiKeys = [createApiKey()];
    setup({
      apiKeys,
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    expect(ApiKeyListMock.mock.calls[0][0].apiKeys).toEqual(apiKeys);
  });

  it("passes isDeleting as false initially", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    expect(ApiKeyListMock.mock.calls[0][0].isDeleting).toBe(false);
  });

  it("passes apiKeyToDelete as null initially", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    expect(ApiKeyListMock.mock.calls[0][0].apiKeyToDelete).toBeNull();
  });

  it("sets apiKeyToDelete when updateApiKeyToDelete is called", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    const apiKey = createApiKey();
    setup({
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    act(() => {
      ApiKeyListMock.mock.calls[0][0].updateApiKeyToDelete(apiKey);
    });

    expect(ApiKeyListMock.mock.lastCall![0].apiKeyToDelete).toEqual(apiKey);
  });

  it("resets apiKeyToDelete when onDeleteClose is called", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    const apiKey = createApiKey();
    setup({
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    act(() => {
      ApiKeyListMock.mock.calls[0][0].updateApiKeyToDelete(apiKey);
    });

    act(() => {
      ApiKeyListMock.mock.lastCall![0].onDeleteClose();
    });

    expect(ApiKeyListMock.mock.lastCall![0].apiKeyToDelete).toBeNull();
  });

  it("calls deleteApiKey and tracks analytics when onDeleteApiKey is called", () => {
    const ApiKeyListMock = vi.fn(ComponentMock);
    const deleteApiKey = vi.fn();
    const { analyticsService } = setup({
      deleteApiKeyMutate: deleteApiKey,
      dependencies: {
        ApiKeyList: ApiKeyListMock
      }
    });

    act(() => {
      ApiKeyListMock.mock.calls[0][0].onDeleteApiKey();
    });

    expect(deleteApiKey).toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("delete_api_key", {
      category: "settings",
      label: "Delete API key"
    });
  });

  it("passes loading state to Layout when api keys are loading", () => {
    const LayoutMock = vi.fn(ComponentMock);
    setup({
      isLoadingApiKeys: true,
      dependencies: {
        Layout: LayoutMock
      }
    });

    expect(LayoutMock.mock.calls[0][0].isLoading).toBe(true);
  });

  it("passes loading state to Layout when deleting", () => {
    const LayoutMock = vi.fn(ComponentMock);
    setup({
      isDeleting: true,
      dependencies: {
        Layout: LayoutMock
      }
    });

    expect(LayoutMock.mock.calls[0][0].isLoading).toBe(true);
  });

  it("sets page title via NextSeo", () => {
    const NextSeoMock = vi.fn(() => null);
    setup({
      dependencies: {
        NextSeo: NextSeoMock
      }
    });

    expect(NextSeoMock.mock.calls[0][0].title).toBe("API Keys");
  });

  it("calls enqueueSnackbar on successful deletion", () => {
    const enqueueSnackbar = vi.fn();
    let onSuccessCallback: (() => void) | undefined;
    const useDeleteApiKey: typeof DEPENDENCIES.useDeleteApiKey = (_id, onSuccess) => {
      onSuccessCallback = onSuccess;
      return { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof DEPENDENCIES.useDeleteApiKey>;
    };

    setup({
      dependencies: {
        useDeleteApiKey,
        enqueueSnackbar
      }
    });

    act(() => {
      onSuccessCallback!();
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith("API Key deleted successfully", {
      variant: "success"
    });
  });

  function setup(
    input: {
      apiKeys?: ApiKeyResponse[];
      isLoadingApiKeys?: boolean;
      isDeleting?: boolean;
      deleteApiKeyMutate?: ReturnType<typeof vi.fn>;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const useUserApiKeys: typeof DEPENDENCIES.useUserApiKeys = () =>
      ({
        data: input.apiKeys,
        isLoading: input.isLoadingApiKeys ?? false
      }) as unknown as ReturnType<typeof DEPENDENCIES.useUserApiKeys>;

    const useDeleteApiKey: typeof DEPENDENCIES.useDeleteApiKey = () =>
      ({
        mutate: input.deleteApiKeyMutate ?? vi.fn(),
        isPending: input.isDeleting ?? false
      }) as unknown as ReturnType<typeof DEPENDENCIES.useDeleteApiKey>;

    const analyticsService = mock<AnalyticsService>();

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <ApiKeysPage
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useUserApiKeys,
            useDeleteApiKey,
            enqueueSnackbar: vi.fn(),
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return {
      analyticsService
    };
  }

  function createApiKey(overrides: Partial<ApiKeyResponse> = {}): ApiKeyResponse {
    return {
      id: "test-id",
      name: "test-key",
      expiresAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastUsedAt: null,
      keyFormat: "ak_****1234",
      ...overrides
    };
  }
});
