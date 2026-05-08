import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import walletStore from "@src/store/walletStore";
import type { DEPENDENCIES } from "./WalletConnectionButtons";
import { WalletConnectionButtons } from "./WalletConnectionButtons";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe(WalletConnectionButtons.name, () => {
  it("renders the Keplr/Leap connect button when self_custody is enabled", () => {
    const ConnectWalletButton = vi.fn(ComponentMock);
    setup({ isSelfCustodyEnabled: true, dependencies: { ConnectWalletButton } });

    expect(ConnectWalletButton).toHaveBeenCalled();
  });

  it("hides the Keplr/Leap connect button when self_custody is disabled", () => {
    const ConnectWalletButton = vi.fn(ComponentMock);
    setup({ isSelfCustodyEnabled: false, dependencies: { ConnectWalletButton } });

    expect(ConnectWalletButton).not.toHaveBeenCalled();
  });

  it("always renders the managed-wallet connect button", () => {
    const ConnectManagedWalletButton = vi.fn(ComponentMock);
    setup({ isSelfCustodyEnabled: false, dependencies: { ConnectManagedWalletButton } });

    expect(ConnectManagedWalletButton).toHaveBeenCalled();
  });

  it("shows the Sign in link when signed in with trial and no user, regardless of flag", () => {
    setup({ isSelfCustodyEnabled: false, isSignedInWithTrial: true, user: null });

    expect(screen.getByRole("link", { name: /Sign in/ })).toBeInTheDocument();
  });

  function setup(input: {
    isSelfCustodyEnabled?: boolean;
    isSignedInWithTrial?: boolean;
    user?: Record<string, unknown> | null;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const store = createStore();
    store.set(walletStore.isSignedInWithTrial, input.isSignedInWithTrial ?? false);

    const dependencies: typeof DEPENDENCIES = {
      useIsSelfCustodyEnabled: () => input.isSelfCustodyEnabled ?? true,
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
          user: ("user" in input ? input.user : { id: "user-1" }) as ReturnType<typeof DEPENDENCIES.useCustomUser>["user"]
        }),
      ConnectManagedWalletButton: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ConnectManagedWalletButton,
      ConnectWalletButton: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ConnectWalletButton,
      ...input.dependencies
    };

    return render(
      <Provider store={store}>
        <WalletConnectionButtons dependencies={dependencies} />
      </Provider>
    );
  }
});
