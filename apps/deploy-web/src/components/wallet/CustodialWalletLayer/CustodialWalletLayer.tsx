"use client";

import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useAtom, useAtomValue } from "jotai";
import { useSnackbar } from "notistack";

import { DefaultWalletModal } from "@src/components/wallet/WalletModal";
import chainStore, { useSelectedChain } from "@src/store/chainStore";
import walletStore from "@src/store/walletStore";

export function CustodialWalletLayer() {
  const selectedWalletType = useAtomValue(walletStore.selectedWalletType);

  if (selectedWalletType !== "custodial") {
    return null;
  }

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

const ModalWrapper = () => {
  const { isWalletConnected } = useSelectedChain();
  const [isWalletModalOpen, setIsWalletModalOpen] = useAtom(walletStore.isWalletModalOpen);
  const [, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const [isOpen] = useAtom(chainStore.modalIsOpenAtom);
  const [walletRepo] = useAtom(chainStore.modalWalletRepoAtom);

  const handleSetOpen = (open: boolean) => {
    chainStore.setModalOpen(open);
  };

  useEffect(() => {
    setIsWalletModalOpen(isOpen);

    if (isWalletModalOpen && !isOpen && isWalletConnected) {
      setSelectedWalletType("custodial");
    }
  }, [isWalletModalOpen, isOpen, isWalletConnected, setIsWalletModalOpen, setSelectedWalletType]);

  return <DefaultWalletModal isOpen={isOpen} setOpen={handleSetOpen} walletRepo={walletRepo} />;
};
