import type { ReactNode } from "react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";

import { akash, akashAssetList } from "@src/chains/akash";
import { ChainStoreProvider } from "../../context/ChainStoreProvider";
import type { WalletsRegistry } from "../../store/ChainStore";
import { CURRENT_WALLET_KEY } from "../../store/constants";
import { useChain } from "./useChain";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useChain.name, () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("when no manager is initialized", () => {
    it("returns disconnected status", () => {
      const { result } = setup();

      expect(result.current.status).toBe("Disconnected");
      expect(result.current.isWalletDisconnected).toBe(true);
      expect(result.current.isWalletConnected).toBe(false);
      expect(result.current.isWalletConnecting).toBe(false);
      expect(result.current.isWalletRejected).toBe(false);
      expect(result.current.isWalletNotExist).toBe(false);
      expect(result.current.isWalletError).toBe(false);
    });

    it("returns undefined address and username", () => {
      const { result } = setup();

      expect(result.current.address).toBeUndefined();
      expect(result.current.username).toBeUndefined();
    });

    it("returns undefined walletRepo", () => {
      const { result } = setup();

      expect(result.current.walletRepo).toBeUndefined();
    });

    it("returns undefined chain", () => {
      const { result } = setup();

      expect(result.current.chain).toBeUndefined();
    });

    it("returns undefined assets", () => {
      const { result } = setup();

      expect(result.current.assets).toBeUndefined();
    });

    it("does not throw when calling openView", () => {
      const { result } = setup();

      expect(() => result.current.openView()).not.toThrow();
    });

    it("does not throw when calling closeView", () => {
      const { result } = setup();

      expect(() => result.current.closeView()).not.toThrow();
    });

    it("does not throw when calling disconnect", () => {
      const { result } = setup();

      expect(() => result.current.disconnect()).not.toThrow();
    });

    it("does not auto-connect even with stored wallet", () => {
      localStorage.setItem(CURRENT_WALLET_KEY, "keplr-extension");

      expect(() => setup()).not.toThrow();
    });
  });

  describe("when walletsRegistry is provided", () => {
    it("initializes manager and exposes walletRepo after connect", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.walletRepo).toBeDefined();
      });
    });

    it("exposes chain info after connect", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.chain).toBeDefined();
        expect(result.current.chain?.chain_id).toBe("akashnet-2");
      });
    });

    it("exposes asset list after connect", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.assets).toBeDefined();
      });
    });

    it("returns undefined address after manager is initialized with no active wallet", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.walletRepo).toBeDefined();
      });

      expect(result.current.address).toBeUndefined();
    });

    it("provides getRpcEndpoint after manager is initialized", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.walletRepo).toBeDefined();
      });

      expect(result.current.getRpcEndpoint).toBeDefined();
    });

    it("provides getRestEndpoint after manager is initialized", async () => {
      const { result } = setup({ walletsRegistry: createKeplrRegistry() });

      await act(() => result.current.connect());

      await waitFor(() => {
        expect(result.current.walletRepo).toBeDefined();
      });

      expect(result.current.getRestEndpoint).toBeDefined();
    });
  });

  function setup(input?: { chainName?: string; walletsRegistry?: WalletsRegistry }) {
    const chainName = input?.chainName ?? "akash";
    const store = createStore();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={store}>
        <ChainStoreProvider walletsRegistry={input?.walletsRegistry ?? []} walletManagerOptions={{ chains: [akash], assetList: [akashAssetList] }}>
          {children}
        </ChainStoreProvider>
      </JotaiProvider>
    );

    return renderHook(() => useChain(chainName), { wrapper });
  }
});

function createKeplrRegistry(): WalletsRegistry {
  return [{ names: ["keplr-extension", "keplr-mobile"], loader: () => import("@cosmos-kit/keplr") }];
}
