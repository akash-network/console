"use client";

import "@interchain-ui/react/globalStyles";
import "@interchain-ui/react/styles";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useChainStore } from "../../context/ChainStoreProvider";
import { useChain } from "../../hooks/useChain/useChain";

type Props = {
  chainName: string;
};

export function ChainStoreInitializer({ chainName }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { message, isWalletError } = useChain(chainName);
  const chainStore = useChainStore();
  const lastShownErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
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
