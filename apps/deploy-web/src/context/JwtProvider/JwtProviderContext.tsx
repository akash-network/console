"use client";
import React, { useEffect, useMemo, useState } from "react";
import { JwtToken, type JwtTokenPayload } from "@akashnetwork/jwt";
import { useSnackbar } from "notistack";

import { useLocalStorage } from "@src/hooks/useLocalStorage";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { useSelectedChain } from "../CustomChainProvider";
import { useServices } from "../ServicesProvider";
import { useSettings } from "../SettingsProvider";
import { useWallet } from "../WalletProvider";

export type LocalToken = {
  token: string;
  address: string;
};

export type ContextType = {
  localToken: LocalToken | null;
  isLocalTokenExpired: boolean;
  setLocalToken: React.Dispatch<LocalToken | null>;
  createToken: () => Promise<void>;
  isCreatingToken: boolean;
};

const JwtProviderContext = React.createContext<ContextType>({} as ContextType);

export const DEPENDENCIES = {
  useSettings,
  useWallet,
  useSnackbar,
  useServices,
  useLocalStorage
};

type Props = {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const JwtProvider: React.FC<Props> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { getAccount, signArbitrary } = useSelectedChain();
  const { analyticsService } = d.useServices();

  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [localToken, setLocalToken] = useState<LocalToken | null>(null);
  const { address, signAndBroadcastTx } = d.useWallet();
  const { isSettingsInit } = d.useSettings();
  const { setLocalStorageItem, removeLocalStorageItem, getLocalStorageItem } = d.useLocalStorage();

  useEffect(() => {
    if (!isSettingsInit) return;

    setLocalToken(null);
    removeLocalStorageItem("jwt");

    if (address) {
      loadLocalToken(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isSettingsInit]);

  const parsedLocalToken = useMemo(() => {
    if (!localToken) return null;
    const jwtToken = new JwtToken({} as any);
    return jwtToken.decodeToken(localToken.token);
  }, [localToken]);

  const loadLocalToken = async (address: string) => {
    const token = getLocalStorageItem(`jwt::${address}`);
    if (token) {
      setLocalToken({ token, address });
      return;
    }
  };

  async function createToken() {
    setIsCreatingToken(true);

    const { pubkey } = await getAccount();

    const jwtToken = new JwtToken({
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
        setLocalStorageItem(`jwt::${address}`, token);
        loadLocalToken(address);

        analyticsService.track("create_jwt", {
          category: "certificates",
          label: "Created jwt"
        });
      }

      setIsCreatingToken(false);
    } catch (error) {
      setIsCreatingToken(false);

      throw error;
    }
  }

  return (
    <JwtProviderContext.Provider
      value={{
        get localToken() {
          return !parsedLocalToken || isExpired(parsedLocalToken) ? null : localToken;
        },
        setLocalToken,
        get isLocalTokenExpired() {
          return !!parsedLocalToken && isExpired(parsedLocalToken);
        },
        isCreatingToken,
        createToken
      }}
    >
      {children}
    </JwtProviderContext.Provider>
  );
};

export const useJwt = (): ContextType => {
  return { ...React.useContext(JwtProviderContext) };
};

function isExpired(parsedLocalToken: JwtTokenPayload) {
  return parsedLocalToken.exp < Date.now() / 1000;
}
