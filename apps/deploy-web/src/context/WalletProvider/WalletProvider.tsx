"use client";
import React, { useEffect, useMemo, useState } from "react";
import { isHttpError, type TxOutput } from "@akashnetwork/http-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useManager } from "@cosmos-kit/react";
import { OpenNewWindow } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SnackbarKey } from "notistack";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import { TransactionModal } from "@src/components/layout/TransactionModal";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useAllowance } from "@src/hooks/useAllowance";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { useBalances } from "@src/queries/useBalancesQuery";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";
import type { AppError } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import { getStorageWallets, updateStorageManagedWallet, updateStorageWallets } from "@src/utils/walletUtils";
import { useSelectedChain } from "../CustomChainProvider";
import { useServices } from "../ServicesProvider";
import { useSettings } from "../SettingsProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";

const ERROR_MESSAGES = {
  5: "Insufficient funds",
  9: "Unknown address",
  11: "Out of gas",
  12: "Memo too large",
  13: "Insufficient fee",
  19: "Tx already in mempool",
  25: "Invalid gas adjustment"
};

export type ContextType = {
  address: string;
  walletName: string;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectManagedWallet: () => void;
  logout: () => void;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  isManaged: boolean;
  isCustodial: boolean;
  isWalletLoading: boolean;
  isTrialing: boolean;
  isOnboarding: boolean;
  creditAmount?: number;
  switchWalletType: () => void;
  hasManagedWallet: boolean;
  managedWalletError?: AppError;
};

/**
 * @private for testing only
 */
export const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

const MESSAGE_STATES: Record<string, LoadingState> = {
  "/akash.deployment.v1beta3.MsgCloseDeployment": "closingDeployment",
  "/akash.deployment.v1beta3.MsgCreateDeployment": "searchingProviders",
  "/akash.market.v1beta4.MsgCreateLease": "creatingDeployment",
  "/akash.deployment.v1beta3.MsgUpdateDeployment": "updatingDeployment",
  "/akash.deployment.v1beta3.MsgDepositDeployment": "depositingDeployment"
};

/**
 * WalletProvider is a client only component
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { analyticsService, tx: txHttpService } = useServices();

  const [, setSettingsId] = useAtom(settingsIdAtom);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const router = useRouter();
  const { settings } = useSettings();
  const user = useUser();
  const userWallet = useSelectedChain();
  const { wallet: managedWallet, isLoading: isManagedWalletLoading, create: createManagedWallet, createError: managedWalletError } = useManagedWallet();
  const [, setIsWalletModelOpen] = useAtom(walletStore.isWalletModalOpen);
  const [selectedWalletType, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const {
    address: walletAddress,
    username,
    isWalletConnected
  } = useMemo(() => (selectedWalletType === "managed" && managedWallet) || userWallet, [managedWallet, userWallet, selectedWalletType]);
  const { refetch: refetchBalances } = useBalances(walletAddress);
  const { addEndpoints } = useManager();
  const isManaged = useMemo(() => !!managedWallet && managedWallet?.address === walletAddress, [walletAddress, managedWallet]);
  const {
    fee: { default: feeGranter }
  } = useAllowance(walletAddress as string, isManaged);
  const [selectedNetworkId, setSelectedNetworkId] = networkStore.useSelectedNetworkIdStore({ reloadOnChange: true });
  const isLoading = (selectedWalletType === "managed" && isManagedWalletLoading) || (selectedWalletType === "custodial" && userWallet.isWalletConnecting);

  useWhen(walletAddress, loadWallet);

  useWhen(isWalletConnected && selectedWalletType, () => {
    if (selectedWalletType === "custodial") {
      analyticsService.track(
        "connect_wallet",
        {
          category: "wallet",
          label: "Connect wallet"
        },
        "GA"
      );
      analyticsService.identify({ custodialWallet: true });
      analyticsService.trackSwitch("connect_wallet", "custodial", "Amplitude");
    } else if (selectedWalletType === "managed") {
      analyticsService.identify({ managedWallet: true });
      analyticsService.trackSwitch("connect_wallet", "managed", "Amplitude");
    }
  });

  useEffect(() => {
    if (!settings.apiEndpoint || !settings.rpcEndpoint) return;

    addEndpoints({
      akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
    });
  }, [addEndpoints, settings.apiEndpoint, settings.rpcEndpoint]);

  useEffect(() => {
    setSettingsId(walletAddress || null);
  }, [walletAddress]);

  function switchWalletType() {
    if (selectedWalletType === "custodial" && !managedWallet) {
      userWallet.disconnect();
    }

    if (selectedWalletType === "managed" && !userWallet.isWalletConnected) {
      setIsWalletModelOpen(true);
      userWallet.connect();
    }

    if (selectedWalletType === "managed" && managedWallet) {
      updateStorageManagedWallet({
        ...managedWallet,
        selected: false
      });
    }

    setSelectedWalletType(prev => (prev === "custodial" ? "managed" : "custodial"));
  }

  function connectManagedWallet() {
    if (!managedWallet) {
      createManagedWallet();
    }
    setSelectedWalletType("managed");
  }

  function logout() {
    userWallet.disconnect();

    analyticsService.track("disconnect_wallet", {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(UrlService.home());

    if (managedWallet) {
      setSelectedWalletType("managed");
    }
  }

  async function loadWallet(): Promise<void> {
    const networkId =
      isManaged && selectedNetworkId !== browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID
        ? browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID
        : undefined;
    let currentWallets = getStorageWallets(networkId);

    if (!currentWallets.some(x => x.address === walletAddress)) {
      currentWallets = [...currentWallets, { name: username || "", address: walletAddress as string, selected: true, isManaged: false }];
    }

    currentWallets = currentWallets.map(x => ({ ...x, selected: x.address === walletAddress }));

    updateStorageWallets(currentWallets, networkId);

    setIsWalletLoaded(true);

    if (networkId) {
      setSelectedNetworkId(networkId);
    }
  }

  async function signAndBroadcastTx(msgs: EncodeObject[]): Promise<boolean> {
    let pendingSnackbarKey: SnackbarKey | null = null;
    let txResult: TxOutput;

    try {
      if (!!user?.id && isManaged) {
        const mainMessage = msgs.find(msg => msg.typeUrl in MESSAGE_STATES);

        if (mainMessage) {
          setLoadingState(MESSAGE_STATES[mainMessage.typeUrl]);
        }

        txResult = await txHttpService.signAndBroadcastTx({ userId: user.id, messages: msgs });
      } else {
        const enqueueTxSnackbar = () => {
          pendingSnackbarKey = enqueueSnackbar(<Snackbar title="Broadcasting transaction..." subTitle="Please wait a few seconds" showLoading />, {
            variant: "info",
            autoHideDuration: null
          });
        };
        setLoadingState("waitingForApproval");
        const estimatedFees = await userWallet.estimateFee(msgs);
        const txRaw = await userWallet.sign(msgs, {
          ...estimatedFees,
          granter: feeGranter
        });

        setLoadingState("broadcasting");
        enqueueTxSnackbar();
        txResult = await userWallet.broadcast(txRaw);

        setLoadingState(undefined);
      }

      if (txResult.code !== 0) {
        throw new Error(txResult.rawLog);
      }

      if (!managedWallet) {
        showTransactionSnackbar("Transaction success!", "", txResult.transactionHash, "success");
      }

      analyticsService.track("successful_tx", {
        category: "transactions",
        label: "Successful transaction"
      });

      return true;
    } catch (err: any) {
      console.error(err);

      if (isHttpError(err) && err.response?.status !== 500) {
        const [title, message] = err.response?.data?.message?.split(": ") ?? [];
        showTransactionSnackbar(title || message || "Error", message, "", "error");
      } else {
        const transactionHash = err.txHash;
        let errorMsg = "An error has occured";

        if (err.message?.includes("was submitted but was not yet found on the chain")) {
          errorMsg = "Transaction timeout";
        } else if (err.message) {
          try {
            const reg = /Broadcasting transaction failed with code (.+?) \(codespace: (.+?)\)/i;
            const match = err.message.match(reg);
            const log = err.message.substring(err.message.indexOf("Log"), err.message.length);

            if (match) {
              const code = parseInt(match[1]);
              const codeSpace = match[2];

              if (codeSpace === "sdk" && code in ERROR_MESSAGES) {
                errorMsg = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
              }
            }

            if (log) {
              errorMsg += `. ${log}`;
            }
          } catch (err) {
            console.error(err);
          }
        }

        if (!errorMsg.includes("Request rejected")) {
          analyticsService.track("failed_tx", {
            category: "transactions",
            label: "Failed transaction"
          });
        }

        showTransactionSnackbar("Transaction has failed...", errorMsg, transactionHash, "error");
      }

      return false;
    } finally {
      refetchBalances();
      if (pendingSnackbarKey) {
        closeSnackbar(pendingSnackbarKey);
      }

      setLoadingState(undefined);
    }
  }

  const showTransactionSnackbar = (
    snackTitle: string,
    snackMessage: string,
    transactionHash: string,
    snackVariant: React.ComponentProps<typeof Snackbar>["iconVariant"]
  ) => {
    enqueueSnackbar(
      <Snackbar
        title={snackTitle}
        subTitle={<TransactionSnackbarContent snackMessage={snackMessage} transactionHash={transactionHash} />}
        iconVariant={snackVariant}
      />,
      {
        variant: snackVariant,
        autoHideDuration: 10000
      }
    );
  };

  return (
    <WalletProviderContext.Provider
      value={{
        address: walletAddress as string,
        walletName: username as string,
        isWalletConnected: isWalletConnected,
        isWalletLoaded: isWalletLoaded,
        connectManagedWallet,
        logout,
        signAndBroadcastTx,
        isManaged,
        isCustodial: !isManaged,
        isWalletLoading: isLoading,
        isTrialing: isManaged && !!managedWallet?.isTrialing,
        isOnboarding: !!user?.userId && isManaged && !!managedWallet?.isTrialing,
        creditAmount: isManaged ? managedWallet?.creditAmount : 0,
        hasManagedWallet: !!managedWallet,
        managedWalletError,
        switchWalletType
      }}
    >
      {children}

      <TransactionModal state={loadingState} />
    </WalletProviderContext.Provider>
  );
};

// Hook
export function useWallet() {
  return { ...React.useContext(WalletProviderContext) };
}

export function useIsManagedWalletUser() {
  const { isManaged } = useWallet();
  return isManaged;
}

const TransactionSnackbarContent: React.FC<{ snackMessage: string; transactionHash: string }> = ({ snackMessage, transactionHash }) => {
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  const txUrl = transactionHash && `${browserEnvConfig.NEXT_PUBLIC_STATS_APP_URL}/transactions/${transactionHash}?network=${selectedNetworkId}`;

  return (
    <>
      {snackMessage}
      {snackMessage && <br />}
      {txUrl && (
        <Link href={txUrl} target="_blank" className="inline-flex items-center space-x-2 !text-white">
          <span>View transaction</span>
          <OpenNewWindow className="text-xs" />
        </Link>
      )}
    </>
  );
};
