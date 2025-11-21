import { mock } from "jest-mock-extended";

import type { useFlag } from "@src/hooks/useFlag";
import { ConnectManagedWalletButton } from "./ConnectManagedWalletButton";

import { render } from "@testing-library/react";

describe(ConnectManagedWalletButton.name, () => {
  it("renders button enabled when blockchain is up", () => {
    const { getByText } = setup({ isBlockchainDown: false });

    expect(getByText("Start Trial").parentElement).not.toHaveAttribute("disabled");
  });

  it("renders button disabled when blockchain is unavailable", () => {
    const { getByText } = setup({ isBlockchainDown: true });

    expect(getByText("Start Trial").parentElement).toHaveAttribute("disabled");
  });

  function setup(input?: { isRegistered?: boolean; isBlockchainDown?: boolean }) {
    const mockUseFlag = jest.fn((flag: string) => {
      if (flag === "notifications_general_alerts_update") {
        return true;
      }
      return false;
    }) as unknown as ReturnType<typeof useFlag>;

    return render(
      <ConnectManagedWalletButton
        dependencies={{
          useFlag: () => mockUseFlag,
          useRouter: () => mock(),
          useSettings: () => ({
            settings: {
              apiEndpoint: "https://api.example.com",
              rpcEndpoint: "https://rpc.example.com",
              isCustomNode: false,
              nodes: [],
              selectedNode: null,
              customNode: null,
              isBlockchainDown: input?.isBlockchainDown ?? false
            },
            setSettings: jest.fn(),
            isLoadingSettings: false,
            isSettingsInit: true,
            refreshNodeStatuses: jest.fn(),
            isRefreshingNodeStatus: false
          })
        }}
      />
    );
  }
});
