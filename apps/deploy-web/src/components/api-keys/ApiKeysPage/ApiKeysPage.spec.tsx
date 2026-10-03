import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { API_REFERENCE_URL, ApiKeysPage, DEPENDENCIES } from "./ApiKeysPage";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildApiKey } from "@tests/seeders";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ApiKeysPage.name, () => {
  it("titles the page and lists the user's keys", () => {
    const apiKeys = [buildApiKey()];
    const { ApiKeyList, SettingsLayout, NextSeo } = setup({ apiKeys });

    expect(NextSeo.mock.lastCall?.[0].title).toBe("API Keys");
    expect(SettingsLayout.mock.lastCall?.[0].title).toBe("API keys");
    expect(ApiKeyList.mock.lastCall?.[0]).toEqual(expect.objectContaining({ apiKeys, isLoading: false, isError: false }));
  });

  it("shows the list loading while keys load", () => {
    const { ApiKeyList, Layout } = setup({ isLoadingApiKeys: true });

    expect(ApiKeyList.mock.lastCall?.[0].isLoading).toBe(true);
    expect(Layout.mock.lastCall?.[0].isLoading).toBe(true);
  });

  it("tells the list when the keys can't load", () => {
    const { ApiKeyList } = setup({ isApiKeysError: true });

    expect(ApiKeyList.mock.lastCall?.[0].isError).toBe(true);
  });

  it("links to the API reference in a new tab", () => {
    setup();

    const link = screen.getByRole("link", { name: "API reference" });
    expect(link).toHaveAttribute("href", API_REFERENCE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens the create key dialog and closes it again", async () => {
    const { user, CreateApiKeyDialog } = setup();
    expect(screen.queryByText("create key dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create new key" }));
    expect(screen.getByText("create key dialog")).toBeInTheDocument();

    act(() => CreateApiKeyDialog.mock.lastCall?.[0].onClose());
    expect(screen.queryByText("create key dialog")).not.toBeInTheDocument();
  });

  it("asks to confirm before revoking the key picked in the list", () => {
    const apiKey = buildApiKey({ id: "key-1" });
    const { ApiKeyList, RevokeApiKeyDialog, useDeleteApiKey } = setup({ apiKeys: [apiKey] });
    expect(screen.queryByText("revoke key dialog")).not.toBeInTheDocument();
    expect(useDeleteApiKey).toHaveBeenLastCalledWith("", expect.any(Function));

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));

    expect(screen.getByText("revoke key dialog")).toBeInTheDocument();
    expect(RevokeApiKeyDialog.mock.lastCall?.[0]).toEqual(expect.objectContaining({ apiKey, isRevoking: false }));
    expect(useDeleteApiKey).toHaveBeenLastCalledWith("key-1", expect.any(Function));
  });

  it("revokes the key and tracks it once confirmed", () => {
    const apiKey = buildApiKey();
    const { ApiKeyList, RevokeApiKeyDialog, deleteApiKey, analyticsService } = setup({ apiKeys: [apiKey] });

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));
    act(() => RevokeApiKeyDialog.mock.lastCall?.[0].onConfirm());

    expect(deleteApiKey).toHaveBeenCalledOnce();
    expect(analyticsService.track).toHaveBeenCalledWith("delete_api_key", { category: "settings", label: "Delete API key" });
  });

  it("tells the user when the key can't be revoked and keeps the dialog open", () => {
    const apiKey = buildApiKey();
    const { ApiKeyList, RevokeApiKeyDialog, deleteApiKey, enqueueSnackbar } = setup({ apiKeys: [apiKey] });
    deleteApiKey.mockImplementation((_variables, options) => options?.onError?.(new Error("boom"), undefined, undefined));

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));
    act(() => RevokeApiKeyDialog.mock.lastCall?.[0].onConfirm());

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't revoke the key" }) }), {
      variant: "error"
    });
    expect(screen.getByText("revoke key dialog")).toBeInTheDocument();
  });

  it("shows the revoke in progress", () => {
    const apiKey = buildApiKey();
    const { ApiKeyList, RevokeApiKeyDialog } = setup({ apiKeys: [apiKey], isRevoking: true });

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));

    expect(RevokeApiKeyDialog.mock.lastCall?.[0].isRevoking).toBe(true);
  });

  it("confirms the revoke and closes the dialog once the key is gone", () => {
    const apiKey = buildApiKey({ name: "Monitoring" });
    const { ApiKeyList, useDeleteApiKey, enqueueSnackbar } = setup({ apiKeys: [apiKey] });

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));
    const onRevoked = useDeleteApiKey.mock.lastCall?.[1];
    act(() => onRevoked?.());

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "“Monitoring” revoked" }) }), {
      variant: "success"
    });
    expect(screen.queryByText("revoke key dialog")).not.toBeInTheDocument();
  });

  it("keeps the key when the revoke is cancelled", () => {
    const apiKey = buildApiKey();
    const { ApiKeyList, RevokeApiKeyDialog, deleteApiKey } = setup({ apiKeys: [apiKey] });

    act(() => ApiKeyList.mock.lastCall?.[0].onRevoke(apiKey));
    act(() => RevokeApiKeyDialog.mock.lastCall?.[0].onCancel());

    expect(screen.queryByText("revoke key dialog")).not.toBeInTheDocument();
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  function setup(input: { apiKeys?: ApiKeyResponse[]; isLoadingApiKeys?: boolean; isApiKeysError?: boolean; isRevoking?: boolean } = {}) {
    const user = userEvent.setup();
    const deleteApiKey = vi.fn<ReturnType<typeof DEPENDENCIES.useDeleteApiKey>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();

    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const NextSeo = vi.fn<typeof DEPENDENCIES.NextSeo>(() => <></>);
    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ headerActions, children }) => (
      <>
        {headerActions}
        {children}
      </>
    ));
    const ApiKeyList = vi.fn<typeof DEPENDENCIES.ApiKeyList>(() => <></>);
    const CreateApiKeyDialog = vi.fn<typeof DEPENDENCIES.CreateApiKeyDialog>(() => <div>create key dialog</div>);
    const RevokeApiKeyDialog = vi.fn<typeof DEPENDENCIES.RevokeApiKeyDialog>(() => <div>revoke key dialog</div>);
    const useUserApiKeys: typeof DEPENDENCIES.useUserApiKeys = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUserApiKeys>>(), {
        data: input.apiKeys,
        isLoading: input.isLoadingApiKeys ?? false,
        isError: input.isApiKeysError ?? false
      });
    const useDeleteApiKey = vi.fn<typeof DEPENDENCIES.useDeleteApiKey>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeleteApiKey>>(), {
        mutate: deleteApiKey,
        isPending: input.isRevoking ?? false
      })
    );
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <ApiKeysPage
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            Layout,
            NextSeo,
            SettingsLayout,
            ApiKeyList,
            CreateApiKeyDialog,
            RevokeApiKeyDialog,
            useUserApiKeys,
            useDeleteApiKey,
            useSnackbar
          }}
        />
      </TestContainerProvider>
    );

    return {
      user,
      deleteApiKey,
      enqueueSnackbar,
      analyticsService,
      Layout,
      NextSeo,
      SettingsLayout,
      ApiKeyList,
      CreateApiKeyDialog,
      RevokeApiKeyDialog,
      useDeleteApiKey
    };
  }
});
