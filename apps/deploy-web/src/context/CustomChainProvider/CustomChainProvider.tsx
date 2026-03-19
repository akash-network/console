"use client";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import type { ChainContext } from "@cosmos-kit/core";
import { DefaultModal } from "@cosmos-kit/react";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";

import chainStore, { useChain } from "@src/store/chainStore";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";

type Props = {
  children: React.ReactNode;
};

function ChainStoreInitializer() {
  useEffect(() => {
    chainStore.initialize();
    return () => {
      chainStore.cleanup();
    };
  }, []);

  return null;
}

export function CustomChainProvider({ children }: Props) {
  return (
    <>
      <ChainStoreInitializer />
      <WalletConnectErrorHandler />
      <ModalWrapper />
      {children}
    </>
  );
}

/**
 * Watches wallet connection state and shows user-friendly messages for WalletConnect errors
 */
function WalletConnectErrorHandler() {
  const { enqueueSnackbar } = useSnackbar();
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  const { message, isWalletError } = useChain(chainRegistryName);
  const lastShownErrorRef = useRef<string | undefined>(undefined);

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

export type { ChainContext };
export function useSelectedChain(): ChainContext {
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  return useChain(chainRegistryName);
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

  return <DefaultModal isOpen={isOpen} setOpen={handleSetOpen} walletRepo={walletRepo} />;
};
