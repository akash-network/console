import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./WalletConnectionButtons";
import { WalletConnectionButtons } from "./WalletConnectionButtons";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe(WalletConnectionButtons.name, () => {
  it("renders the managed-wallet connect button", () => {
    const ConnectManagedWalletButton = vi.fn(ComponentMock);
    setup({ dependencies: { ConnectManagedWalletButton } });

    expect(ConnectManagedWalletButton).toHaveBeenCalled();
  });

  function setup(input: { dependencies?: Partial<typeof DEPENDENCIES> }) {
    const dependencies: typeof DEPENDENCIES = {
      ConnectManagedWalletButton: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ConnectManagedWalletButton,
      ...input.dependencies
    };

    return render(<WalletConnectionButtons dependencies={dependencies} />);
  }
});
