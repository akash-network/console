import React from "react";
import { MAINNET_ID } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RootContainer } from "../ServicesProvider/ServicesContext";
import { DEPENDENCIES, SettingsProvider, useSettings } from "./SettingsProviderContext";

import { render, screen, waitFor } from "@testing-library/react";

describe(SettingsProvider.name, () => {
  it("initializes static proxy endpoints and marks settings ready once networks are loaded", async () => {
    setup();

    await waitFor(() => expect(screen.getByTestId("is-settings-init")).toHaveTextContent("true"));
    expect(screen.getByTestId("is-loading-settings")).toHaveTextContent("false");
    expect(screen.getByTestId("rpc-endpoint")).toHaveTextContent("https://rpc.example.com");
    expect(screen.getByTestId("api-endpoint").textContent).not.toBe("");
  });

  it("does not initialize settings while networks are still loading", async () => {
    const { get } = setup({ isLoadingNetworks: true });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getByTestId("is-settings-init")).toHaveTextContent("false");
  });

  it("polls the blockchain-status endpoint and keeps the chain up when it is reachable", async () => {
    const { get } = setup({ isBlockchainReachable: true });

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("/v1/blockchain-status")));
    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
  });

  it("marks the chain as down when the status endpoint reports it unreachable", async () => {
    setup({ isBlockchainReachable: false });

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
  });

  it("marks the chain as down when the status request fails", async () => {
    setup({ failStatus: true });

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
  });

  function setup(input?: { isBlockchainReachable?: boolean; failStatus?: boolean; isLoadingNetworks?: boolean }) {
    const get = vi.fn(async () => {
      if (input?.failStatus) throw new Error("network error");
      return { data: { isBlockchainReachable: input?.isBlockchainReachable ?? true } };
    });

    const useRootContainer: typeof DEPENDENCIES.useRootContainer = () =>
      mock<RootContainer>({
        publicConsoleApiHttpClient: mock<RootContainer["publicConsoleApiHttpClient"]>({ get } as unknown as RootContainer["publicConsoleApiHttpClient"]),
        networkStore: mock<RootContainer["networkStore"]>({
          useSelectedNetwork: () =>
            mock<ReturnType<RootContainer["networkStore"]["useSelectedNetwork"]>>({ id: MAINNET_ID, rpcEndpoint: "https://rpc.example.com" }),
          useNetworksStore: () =>
            [{ isLoading: input?.isLoadingNetworks ?? false }, vi.fn()] as unknown as ReturnType<RootContainer["networkStore"]["useNetworksStore"]>
        })
      });

    render(
      <SettingsProvider dependencies={{ ...DEPENDENCIES, useRootContainer, usePreviousRoute: vi.fn(), migrateLocalStorage: vi.fn() }}>
        <TestConsumer />
      </SettingsProvider>
    );

    return { get };
  }
});

function TestConsumer() {
  const { settings, isSettingsInit, isLoadingSettings } = useSettings();
  return (
    <div>
      <span data-testid="is-settings-init">{String(isSettingsInit)}</span>
      <span data-testid="is-loading-settings">{String(isLoadingSettings)}</span>
      <span data-testid="is-blockchain-down">{String(settings.isBlockchainDown)}</span>
      <span data-testid="api-endpoint">{settings.apiEndpoint}</span>
      <span data-testid="rpc-endpoint">{settings.rpcEndpoint}</span>
    </div>
  );
}
