import { SnackbarProvider } from "notistack";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainStore } from "../../store/ChainStore";
import type { DEPENDENCIES } from "./ChainStoreInitializer";
import { ChainStoreInitializer } from "./ChainStoreInitializer";

import { render } from "@testing-library/react";

describe(ChainStoreInitializer.name, () => {
  it("calls chainStore.initialize on mount", () => {
    const { chainStore } = setup();

    expect(chainStore.initialize).toHaveBeenCalledOnce();
  });

  it("calls chainStore.cleanup on unmount", () => {
    const { chainStore, unmount } = setup();

    unmount();

    expect(chainStore.cleanup).toHaveBeenCalledOnce();
  });

  function setup() {
    const chainStore = mock<ChainStore>();
    const dependencies: typeof DEPENDENCIES = {
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
