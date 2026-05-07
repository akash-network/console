import { SnackbarProvider } from "notistack";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainStore } from "../../store/ChainStore";
import { CURRENT_WALLET_KEY } from "../../store/constants";
import type { DEPENDENCIES } from "./ChainStoreInitializer";
import { ChainStoreInitializer } from "./ChainStoreInitializer";

import { render } from "@testing-library/react";

describe(ChainStoreInitializer.name, () => {
  it("clears CURRENT_WALLET_KEY before initialize when self_custody flag is OFF", () => {
    window.localStorage.setItem(CURRENT_WALLET_KEY, "keplr-extension");

    const { chainStore } = setup({ isSelfCustodyEnabled: false });

    expect(window.localStorage.getItem(CURRENT_WALLET_KEY)).toBeNull();
    expect(chainStore.initialize).toHaveBeenCalledOnce();
  });

  it("leaves CURRENT_WALLET_KEY untouched when self_custody flag is ON", () => {
    window.localStorage.setItem(CURRENT_WALLET_KEY, "keplr-extension");

    const { chainStore } = setup({ isSelfCustodyEnabled: true });

    expect(window.localStorage.getItem(CURRENT_WALLET_KEY)).toBe("keplr-extension");
    expect(chainStore.initialize).toHaveBeenCalledOnce();
  });

  it("is a no-op on the localStorage key when no wallet was previously stored", () => {
    window.localStorage.removeItem(CURRENT_WALLET_KEY);

    const { chainStore } = setup({ isSelfCustodyEnabled: false });

    expect(window.localStorage.getItem(CURRENT_WALLET_KEY)).toBeNull();
    expect(chainStore.initialize).toHaveBeenCalledOnce();
  });

  it("calls chainStore.cleanup on unmount", () => {
    const { chainStore, unmount } = setup({ isSelfCustodyEnabled: true });

    unmount();

    expect(chainStore.cleanup).toHaveBeenCalledOnce();
  });

  function setup(input: { isSelfCustodyEnabled: boolean }) {
    const chainStore = mock<ChainStore>();
    const dependencies: typeof DEPENDENCIES = {
      useIsSelfCustodyEnabled: () => input.isSelfCustodyEnabled,
      useChain: vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.useChain>>({ message: undefined, isWalletError: false })),
      useChainStore: () => chainStore
    };

    const { unmount } = render(
      <SnackbarProvider>
        <ChainStoreInitializer chainName="akashnet-2" dependencies={dependencies} />
      </SnackbarProvider>
    );

    return { chainStore, unmount };
  }
});
