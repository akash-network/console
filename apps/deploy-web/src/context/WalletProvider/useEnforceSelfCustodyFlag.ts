import { useEffect } from "react";

import { useIsSelfCustodyEnabled } from "@src/hooks/useIsSelfCustodyEnabled";
import { CURRENT_WALLET_KEY } from "@src/lib/cosmos-kit-jotai";
import type { SelectedWalletType } from "@src/store/walletStore";

export const DEPENDENCIES = {
  useIsSelfCustodyEnabled
};

export type UseEnforceSelfCustodyFlagInput = {
  isWalletConnected: boolean;
  selectedWalletType: SelectedWalletType;
  setSelectedWalletType: (type: SelectedWalletType) => void;
  disconnect: () => void;
};

export function useEnforceSelfCustodyFlag(input: UseEnforceSelfCustodyFlagInput, dependencies: typeof DEPENDENCIES = DEPENDENCIES): void {
  const isSelfCustodyEnabled = dependencies.useIsSelfCustodyEnabled();
  const { isWalletConnected, selectedWalletType, setSelectedWalletType, disconnect } = input;

  useEffect(() => {
    if (isSelfCustodyEnabled) return;
    if (selectedWalletType !== "custodial" && !isWalletConnected) return;

    if (isWalletConnected) {
      disconnect();
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    }

    if (selectedWalletType !== "managed") {
      setSelectedWalletType("managed");
    }
  }, [isSelfCustodyEnabled, isWalletConnected, selectedWalletType, disconnect, setSelectedWalletType]);
}
