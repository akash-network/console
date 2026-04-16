"use client";

import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { useCallback, useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useAtom, useAtomValue } from "jotai";
import dynamic from "next/dynamic";
import { useSnackbar } from "notistack";

import { chainStore, useSelectedChain } from "@src/store/chainStore";
import walletStore from "@src/store/walletStore";

export function CustodialWalletLayer() {
  return (
    <>
      <ChainStoreInitializer />
      <ModalWrapper />
    </>
  );
}

function ChainStoreInitializer() {
  const { enqueueSnackbar } = useSnackbar();
  const { message, isWalletError } = useSelectedChain();
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

const WalletModal = dynamic(() => import("@src/components/wallet/WalletModal/WalletModal").then(mod => mod.WalletModal), { ssr: false });

function ModalWrapper() {
  const [, setIsWalletModalOpen] = useAtom(walletStore.isWalletModalOpen);
  const isOpen = useAtomValue(chainStore.modalIsOpenAtom);
  const walletRepo = useAtomValue(chainStore.modalWalletRepoAtom);

  const toggleOpen = useCallback((open: boolean) => {
    chainStore.toggleModalOpen(open);
  }, []);

  useEffect(() => {
    setIsWalletModalOpen(isOpen);
  }, [isOpen, setIsWalletModalOpen]);

  return <WalletModal isOpen={isOpen} setOpen={toggleOpen} walletRepo={walletRepo} />;
}
