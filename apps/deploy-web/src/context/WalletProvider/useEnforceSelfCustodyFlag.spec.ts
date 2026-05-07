import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CURRENT_WALLET_KEY } from "@src/lib/cosmos-kit-jotai";
import type { SelectedWalletType } from "@src/store/walletStore";
import { type DEPENDENCIES, useEnforceSelfCustodyFlag, type UseEnforceSelfCustodyFlagInput } from "./useEnforceSelfCustodyFlag";

import { renderHook } from "@testing-library/react";

describe(useEnforceSelfCustodyFlag.name, () => {
  it("disconnects, clears CURRENT_WALLET_KEY, and switches to managed when flag is OFF and a custodial wallet is connected", () => {
    const { disconnect, setSelectedWalletType, localStorage } = setup({
      isSelfCustodyEnabled: false,
      isWalletConnected: true,
      selectedWalletType: "custodial"
    });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(localStorage.removeItem).toHaveBeenCalledWith(CURRENT_WALLET_KEY);
    expect(setSelectedWalletType).toHaveBeenCalledWith("managed");
  });

  it("clears stored wallet name and switches type when flag is OFF and selectedWalletType is still custodial without an active connection", () => {
    const { disconnect, setSelectedWalletType, localStorage } = setup({
      isSelfCustodyEnabled: false,
      isWalletConnected: false,
      selectedWalletType: "custodial"
    });

    expect(disconnect).not.toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith(CURRENT_WALLET_KEY);
    expect(setSelectedWalletType).toHaveBeenCalledWith("managed");
  });

  it("does nothing when flag is OFF and the user is already on managed without a custodial connection", () => {
    const { disconnect, setSelectedWalletType, localStorage } = setup({
      isSelfCustodyEnabled: false,
      isWalletConnected: false,
      selectedWalletType: "managed"
    });

    expect(disconnect).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(setSelectedWalletType).not.toHaveBeenCalled();
  });

  it("does nothing when flag is ON regardless of wallet state", () => {
    const { disconnect, setSelectedWalletType, localStorage } = setup({
      isSelfCustodyEnabled: true,
      isWalletConnected: true,
      selectedWalletType: "custodial"
    });

    expect(disconnect).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(setSelectedWalletType).not.toHaveBeenCalled();
  });

  function setup(input: { isSelfCustodyEnabled: boolean; isWalletConnected: boolean; selectedWalletType: SelectedWalletType }) {
    const disconnect = vi.fn();
    const setSelectedWalletType = vi.fn();
    const localStorage = mock<Storage>();
    const dependencies: typeof DEPENDENCIES = {
      useIsSelfCustodyEnabled: () => input.isSelfCustodyEnabled,
      localStorage
    };

    const hookInput: UseEnforceSelfCustodyFlagInput = {
      isWalletConnected: input.isWalletConnected,
      selectedWalletType: input.selectedWalletType,
      setSelectedWalletType,
      disconnect
    };

    renderHook(() => useEnforceSelfCustodyFlag(hookInput, dependencies));

    return { disconnect, setSelectedWalletType, localStorage };
  }
});
