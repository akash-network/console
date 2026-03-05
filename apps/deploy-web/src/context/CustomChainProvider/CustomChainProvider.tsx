"use client";
import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { GasPrice } from "@cosmjs/stargate";
import type { ChainContext, WalletModalProps } from "@cosmos-kit/core";
import { wallets as metamask } from "@cosmos-kit/cosmos-extension-metamask";
import { wallets as cosmostation } from "@cosmos-kit/cosmostation-extension";
import { wallets as keplr } from "@cosmos-kit/keplr";
import { wallets as leap } from "@cosmos-kit/leap";
import { ChainProvider, DefaultModal, useChain } from "@cosmos-kit/react";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";

import { akash, akashSandbox, akashTestnet, assetLists } from "@src/chains";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";
import { registry } from "@src/utils/customRegistry";

type Props = {
  children: React.ReactNode;
};

export function CustomChainProvider({ children }: Props) {
  return (
    <ChainProvider
      chains={[akash, akashSandbox, akashTestnet]}
      assetLists={assetLists}
      wallets={[...keplr, ...leap, ...cosmostation, ...metamask]}
      walletModal={ModalWrapper}
      sessionOptions={{
        duration: 31_556_926_000, // 1 year
        callback: () => {
          console.log("session expired");
          window.localStorage.removeItem("cosmos-kit@2:core//current-wallet");
          window.location.reload();
        }
      }}
      walletConnectOptions={{
        signClient: {
          projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string
        }
      }}
      endpointOptions={{
        isLazy: true,
        endpoints: {
          akash: { rest: [], rpc: [] },
          "akash-sandbox": { rest: [], rpc: [] },
          "akash-testnet": { rest: [], rpc: [] }
        }
      }}
      signerOptions={{
        preferredSignType: () => "direct",
        signingStargate: () =>
          ({
            registry,
            gasPrice: GasPrice.fromString("0.025uakt")
          }) as any
      }}
    >
      <WalletConnectErrorHandler />
      {children}
    </ChainProvider>
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

    // Only show snackbar if this is a new error (not already shown)
    if (isProposalExpired && lastShownErrorRef.current !== message) {
      lastShownErrorRef.current = message;
      enqueueSnackbar(
        <Snackbar title="Wallet connection timed out" subTitle="The connection request expired. Please try connecting again." iconVariant="warning" />,
        { variant: "warning", autoHideDuration: 6000 }
      );
    }

    // Reset when error clears
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

const ModalWrapper = (props: WalletModalProps) => {
  const { isWalletConnected } = useSelectedChain();
  const [isWalletModalOpen, setIsWalletModalOpen] = useAtom(walletStore.isWalletModalOpen);
  const [, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);

  useEffect(() => {
    setIsWalletModalOpen(props.isOpen);

    if (isWalletModalOpen && !props.isOpen && isWalletConnected) {
      setSelectedWalletType("custodial");
    }
  }, [isWalletModalOpen, props.isOpen, isWalletConnected]);

  return <DefaultModal {...props} isOpen={props.isOpen} setOpen={props.setOpen} />;
};
