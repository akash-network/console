import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import walletStore from "@src/store/walletStore";
import type { DEPENDENCIES } from "./WalletConnectionButtons";
import { WalletConnectionButtons } from "./WalletConnectionButtons";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe(WalletConnectionButtons.name, () => {
  it("renders the managed-wallet connect button by default", () => {
    const ConnectManagedWalletButton = vi.fn(ComponentMock);
    setup({ dependencies: { ConnectManagedWalletButton } });

    expect(ConnectManagedWalletButton).toHaveBeenCalled();
  });

  it("shows the Sign in link when signed in with trial and no user", () => {
    setup({ isSignedInWithTrial: true, user: null });

    expect(screen.getByRole("link", { name: /Sign in/ })).toBeInTheDocument();
  });

  function setup(input: { isSignedInWithTrial?: boolean; user?: Record<string, unknown> | null; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const store = createStore();
    store.set(walletStore.isSignedInWithTrial, input.isSignedInWithTrial ?? false);

    const dependencies: typeof DEPENDENCIES = {
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
          user: ("user" in input ? input.user : { id: "user-1" }) as ReturnType<typeof DEPENDENCIES.useCustomUser>["user"]
        }),
      ConnectManagedWalletButton: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ConnectManagedWalletButton,
      ...input.dependencies
    };

    return render(
      <Provider store={store}>
        <WalletConnectionButtons dependencies={dependencies} />
      </Provider>
    );
  }
});
