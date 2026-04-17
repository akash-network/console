import { describe, expect, it, vi } from "vitest";

import { CustomChainProvider, DEPENDENCIES } from "./CustomChainProvider";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(CustomChainProvider.name, () => {
  it("renders children", () => {
    setup();

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders ModalWrapper", () => {
    const { dependencies } = setup();

    expect(dependencies.ModalWrapper).toHaveBeenCalled();
  });

  it("passes walletsRegistry to ChainStoreProvider", () => {
    const { dependencies } = setup();

    const call = vi.mocked(dependencies.ChainStoreProvider).mock.calls[0][0];
    expect(call.walletsRegistry).toEqual([
      { names: ["keplr-extension", "keplr-mobile"], loader: expect.any(Function) },
      { names: ["leap-extension", "leap-mobile", "leap-metamask-cosmos-snap"], loader: expect.any(Function) },
      { names: ["cosmostation-extension"], loader: expect.any(Function) },
      { names: ["cosmos-extension-metamask"], loader: expect.any(Function) }
    ]);
  });

  it("passes walletManagerOptions with chains and config to ChainStoreProvider", () => {
    const { dependencies } = setup();

    const call = vi.mocked(dependencies.ChainStoreProvider).mock.calls[0][0];
    expect(call.walletManagerOptions).toEqual(
      expect.objectContaining({
        chains: expect.any(Array),
        assetList: expect.any(Array),
        sessionOptions: expect.objectContaining({ duration: 31_556_926_000 }),
        walletConnectOptions: expect.objectContaining({
          signClient: expect.objectContaining({ projectId: expect.any(String) })
        }),
        endpointOptions: expect.objectContaining({ isLazy: true }),
        signerOptions: expect.objectContaining({
          preferredSignType: expect.any(Function)
        })
      })
    );
  });

  it("initializes ChainStoreInitializer with selected network chain name", () => {
    const chainRegistryName = "akashnet-2";
    const { dependencies } = setup({ chainRegistryName });

    expect(dependencies.ChainStoreInitializer).toHaveBeenCalledWith(expect.objectContaining({ chainName: chainRegistryName }), expect.anything());
  });

  it("uses network from useServices to determine chain name", () => {
    const chainRegistryName = "sandbox-chain";
    const { dependencies } = setup({ chainRegistryName });

    expect(dependencies.useServices).toHaveBeenCalled();
    expect(dependencies.ChainStoreInitializer).toHaveBeenCalledWith(expect.objectContaining({ chainName: chainRegistryName }), expect.anything());
  });

  function setup(input?: { chainRegistryName?: string }) {
    const useSelectedNetwork = vi.fn(() => ({
      chainRegistryName: input?.chainRegistryName ?? "akashnet-2"
    }));

    const dependencies = MockComponents(DEPENDENCIES, {
      useServices: vi.fn(() => ({
        networkStore: { useSelectedNetwork }
      })) as unknown as typeof DEPENDENCIES.useServices
    });

    render(
      <CustomChainProvider dependencies={dependencies}>
        <div data-testid="child" />
      </CustomChainProvider>
    );

    return { dependencies, useSelectedNetwork };
  }
});
