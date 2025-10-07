"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JwtToken, type JwtTokenPayload } from "@akashnetwork/jwt";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getStorageWallets, updateWallet } from "@src/utils/walletUtils";

export type LocalToken = {
  token: string;
  address: string;
};

const DEPENDENCIES = {
  useSelectedChain,
  useServices,
  useWallet,
  useSettings,
  getStorageWallets,
  updateWallet,
  JwtToken
};

export const useJwt = ({ dependencies: d = DEPENDENCIES } = {}) => {
  const { getAccount, signArbitrary } = d.useSelectedChain();
  const { analyticsService } = d.useServices();

  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [localToken, setLocalToken] = useState<LocalToken | null>(null);
  const { address, signAndBroadcastTx } = d.useWallet();
  const { isSettingsInit } = d.useSettings();

  useEffect(() => {
    if (!isSettingsInit) return;

    setLocalToken(null);

    if (address) {
      loadLocalToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isSettingsInit]);

  const parsedLocalToken = useMemo(() => {
    if (!localToken) return null;

    try {
      const jwtToken = new d.JwtToken({} as any);
      return jwtToken.decodeToken(localToken.token);
    } catch (error) {
      return null;
    }
  }, [localToken]);

  const loadLocalToken = useCallback(async () => {
    const wallets = d.getStorageWallets();
    wallets.find(wallet => {
      const token: LocalToken | null = wallet.token ? { token: wallet.token, address: wallet.address } : null;

      if (wallet.address === address) {
        setLocalToken(token);
        return true;
      }
    });
  }, [address]);

  const createToken = useCallback(async () => {
    setIsCreatingToken(true);

    const { pubkey } = await getAccount();

    const jwtToken = new d.JwtToken({
      signArbitrary,
      address,
      pubkey
    });

    const token = await jwtToken.createToken({
      version: "v1",
      iss: "https://example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    });

    try {
      const message = TransactionMessageData.getCreateJwtMsg(address, token);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        d.updateWallet(address, wallet => {
          return {
            ...wallet,
            token
          };
        });
        loadLocalToken();

        analyticsService.track("create_jwt", {
          category: "certificates",
          label: "Created jwt"
        });
      }
    } finally {
      setIsCreatingToken(false);
    }
  }, [getAccount, signArbitrary, address, signAndBroadcastTx, d, loadLocalToken, analyticsService]);

  return useMemo(() => {
    return {
      get localToken() {
        return !parsedLocalToken || isExpired(parsedLocalToken) ? null : localToken;
      },
      get isLocalTokenExpired() {
        return !!parsedLocalToken && isExpired(parsedLocalToken);
      },
      setLocalToken,
      createToken,
      isCreatingToken
    };
  }, [parsedLocalToken, localToken, setLocalToken, createToken, isCreatingToken]);
};

function isExpired(parsedLocalToken: JwtTokenPayload) {
  return parsedLocalToken.exp < Date.now() / 1000;
}
