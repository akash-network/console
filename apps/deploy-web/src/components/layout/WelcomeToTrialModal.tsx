"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Popup } from "@akashnetwork/ui/components";

import { useWallet } from "@src/context/WalletProvider";
import { useLocalStorage } from "@src/hooks/useLocalStorage";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import networkStore from "@src/store/networkStore";

export const WelcomeToTrialModal: React.FunctionComponent = () => {
  const { wallet: managedWallet } = useManagedWallet();
  const { address } = useWallet();
  const selectedNetworkId = networkStore.useSelectedNetworkId();

  const localStorageKey = "welcomeModalSeen";
  const localStorageValue = "true";
  const { getLocalStorageItem, setLocalStorageItem } = useLocalStorage();
  const [shouldModalShow, setShouldModalShow] = useState(false);

  useEffect(() => {
    if (address && selectedNetworkId) {
      setShouldModalShow(getLocalStorageItem(localStorageKey) !== localStorageValue);
    }
  }, [address, getLocalStorageItem, selectedNetworkId]);

  const writeLocalStorage = useCallback(() => {
    setLocalStorageItem(localStorageKey, localStorageValue);
    setShouldModalShow(false);
  }, [setLocalStorageItem]);

  const isWelcomeModalOpen = useMemo(() => {
    return managedWallet?.isTrialing === true && shouldModalShow;
  }, [managedWallet?.isTrialing, shouldModalShow]);

  return (
    <>
      {isWelcomeModalOpen && (
        <Popup
          fullWidth
          open={isWelcomeModalOpen}
          variant="custom"
          actions={[
            {
              label: "Close",
              color: "primary",
              variant: "text",
              side: "right",
              onClick: writeLocalStorage
            }
          ]}
          onClose={writeLocalStorage}
          maxWidth="sm"
          enableCloseOnBackdropClick
          title="Welcome to Your Free Trial!"
        >
          <>
            <p className="mb-4">
              You&apos;re all set to start deploying your first service. During your trial, you can create and manage up to 5 deployments — perfect for
              exploring everything our platform has to offer.
            </p>
            <p>Get started now and see what you can build!</p>
          </>
        </Popup>
      )}
    </>
  );
};
