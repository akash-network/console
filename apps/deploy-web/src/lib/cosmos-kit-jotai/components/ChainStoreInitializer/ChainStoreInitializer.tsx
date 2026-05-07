"use client";

import "@interchain-ui/react/globalStyles";
import "@interchain-ui/react/styles";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useIsSelfCustodyEnabled } from "@src/hooks/useIsSelfCustodyEnabled";
import { useChainStore } from "../../context/ChainStoreProvider";
import { useChain } from "../../hooks/useChain/useChain";
import { CURRENT_WALLET_KEY } from "../../store/constants";

type Props = {
  chainName: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  useIsSelfCustodyEnabled,
  useChain,
  useChainStore
};

export function ChainStoreInitializer({ chainName, dependencies = DEPENDENCIES }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { message, isWalletError } = dependencies.useChain(chainName);
  const chainStore = dependencies.useChainStore();
  const isSelfCustodyEnabled = dependencies.useIsSelfCustodyEnabled();
  const lastShownErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isSelfCustodyEnabled && typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    }
    chainStore.initialize();
    return () => {
      chainStore.cleanup();
    };
  }, []);

  useEffect(() => {
    const isProposalExpired = isWalletError && message?.toLowerCase().includes("proposal expired");

    if (isProposalExpired && lastShownErrorRef.current !== message) {
      lastShownErrorRef.current = message;
      enqueueSnackbar(
        <Snackbar title="Wallet connection timed out" subTitle="The connection request expired. Please try connecting again." iconVariant="warning" />,
        { variant: "warning", autoHideDuration: 6000 }
      );
    }

    if (!isWalletError) {
      lastShownErrorRef.current = undefined;
    }
  }, [isWalletError, message, enqueueSnackbar]);

  return null;
}
