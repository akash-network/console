"use client";
import React, { useEffect, useMemo, useState } from "react";
import { isHttpError, type TxOutput } from "@akashnetwork/http-sdk";
import { buttonVariants, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { OpenNewWindow } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SnackbarKey } from "notistack";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useSelectedChain } from "@src/hooks/useSelectedChain/useSelectedChain";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { CURRENT_WALLET_KEY, useManager } from "@src/lib/cosmos-kit-jotai";
import { useBalances } from "@src/queries/useBalancesQuery";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";
import type { AppError } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import { getStorageWallets, updateStorageManagedWallet, updateStorageWallets } from "@src/utils/walletUtils";
import { useServices } from "../ServicesProvider";
import { useSettings } from "../SettingsProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";
import { deriveWalletIsLoading } from "./deriveWalletIsLoading";
import { useEnforceSelfCustodyFlag } from "./useEnforceSelfCustodyFlag";

const CONSOLE_MEMO = "akash console";

const ERROR_MESSAGES = {
  5: "Insufficient funds",
  9: "Unknown address",
  11: "Out of gas",
  12: "Memo too large",
  13: "Insufficient fee",
  19: "Tx already in mempool",
  25: "Invalid gas adjustment"
};

type ManagedWalletMarker =
  | {
      isManaged: true;
      denom: string;
    }
  | {
      isManaged: false;
      denom: undefined;
    };

export type ContextType = {
  address: string;
  walletName: string;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectManagedWallet: () => void;
  logout: () => void;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  isCustodial: boolean;
  isWalletLoading: boolean;
  isTrialing: boolean;
  isOnboarding: boolean;
  creditAmount?: number;
  topUpMinAmountUsd: number;
  switchWalletType: () => void;
  hasManagedWallet: boolean;
  managedWalletError?: AppError;
} & ManagedWalletMarker;

/**
 * @private for testing only
 */
export const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

const MESSAGE_STATES: Record<string, LoadingState> = {
  "/akash.deployment.v1beta4.MsgCloseDeployment": "closingDeployment",
  "/akash.deployment.v1beta4.MsgCreateDeployment": "searchingProviders",
  "/akash.market.v1beta5.MsgCreateLease": "creatingDeployment",
  "/akash.deployment.v1beta4.MsgUpdateDeployment": "updatingDeployment",
  "/akash.escrow.v1.MsgAccountDeposit": "depositingDeployment"
};

/**
 * WalletProvider is a client only component
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { analyticsService, tx: txHttpService, publicConfig: appConfig, urlService, windowLocation } = useServices();

  const [, setSettingsId] = useAtom(settingsIdAtom);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const router = useRouter();
  const { settings } = useSettings();
  const { user } = useUser();
  const userWallet = useSelectedChain();
  const { wallet: managedWallet, isLoading: isManagedWalletLoading, create: createManagedWallet, createError: managedWalletError } = useManagedWallet();
  const [selectedWalletType, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const {
    address: walletAddress,
    username,
    isWalletConnected
  } = useMemo(() => (selectedWalletType === "managed" && managedWallet) || userWallet, [managedWallet, userWallet, selectedWalletType]);
  const { refetch: refetchBalances } = useBalances(walletAddress);
  const custodialWalletManager = useManager();
  const managedMarker = useMemo((): ManagedWalletMarker => {
    if (!!managedWallet && managedWallet?.address === walletAddress) {
      return { isManaged: true, denom: managedWallet.denom };
    }

    return { isManaged: false, denom: undefined };
  }, [walletAddress, managedWallet]);
  const { isManaged } = managedMarker;
  const [selectedNetworkId, setSelectedNetworkId] = networkStore.useSelectedNetworkIdStore();
  const isLoading = deriveWalletIsLoading({
    hasAuthenticatedUserId: !!user?.userId,
    selectedWalletType,
    isManagedWalletLoading,
    isCustodialConnecting: userWallet.isWalletConnecting
  });

  useEnforceSelfCustodyFlag({
    isWalletConnected: userWallet.isWalletConnected,
    selectedWalletType,
    setSelectedWalletType,
    disconnect: userWallet.disconnect
  });

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

    custodialWalletManager?.addEndpoints({
      akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
    });
  }, [custodialWalletManager, settings.apiEndpoint, settings.rpcEndpoint]);

  useEffect(() => {
    setSettingsId(walletAddress || null);
  }, [walletAddress]);

  /**
   * Force every visitor onto the managed-wallet network on first load, regardless of `selectedWalletType`.
   *
   * Why unconditional: in the onboarding redesign, every authenticated user gets a managed trial wallet,
   * and the entire console experience targets that network. Previously this effect only fired when
   * `selectedWalletType === "managed"`, which meant the switch happened *after* `useManagedWallet`
   * auto-flipped the wallet type — i.e. mid-deploy if the trial creation completed during a deploy —
   * tearing down in-flight requests. Firing on first load instead means the (one-time) reload happens
   * before any user action.
   *
   * Why `reload()` not `href = home`: a hard nav to `/` was sending the user back to home after a
   * successful deploy if the wallet-type flip happened post-success. Reloading in place keeps the URL.
   *
   * The localStorage-backed atom makes this a single reload per browser — subsequent loads see the
   * managed network already selected and skip the effect entirely.
   */
  useEffect(() => {
    if (selectedNetworkId === appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID) return;
    setSelectedNetworkId(appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID);
    windowLocation.reload();
  }, [selectedNetworkId, appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID, setSelectedNetworkId, windowLocation]);

  function switchWalletType() {
    if (selectedWalletType === "custodial" && !managedWallet) {
      userWallet.disconnect();
    }

    if (selectedWalletType === "custodial" && typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    }

    if (selectedWalletType === "managed" && !userWallet.isWalletConnected) {
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

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    }

    analyticsService.track("disconnect_wallet", {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(urlService.home());

    if (managedWallet) {
      setSelectedWalletType("managed");
    }
  }

  async function loadWallet(): Promise<void> {
    const networkId =
      isManaged && selectedNetworkId !== appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID ? appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID : undefined;
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
        const estimatedFees = await userWallet.estimateFee(msgs, undefined, CONSOLE_MEMO);
        const txRaw = await userWallet.sign(msgs, estimatedFees, CONSOLE_MEMO);

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
        if (err.response?.status === 402) {
          showAddCreditsSnackbar(title || message || "Add credits to continue", message);
        } else {
          showTransactionSnackbar(title || message || "Error", message, "", "error");
        }
      } else {
        const transactionHash = err.txHash;
        let errorMsg = "An error has occurred";

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
        subTitle={<TransactionSnackbarContent snackMessage={snackMessage} transactionHash={transactionHash} isError={snackVariant === "error"} />}
        iconVariant={snackVariant}
      />,
      {
        variant: snackVariant,
        autoHideDuration: 10000
      }
    );
  };

  const showAddCreditsSnackbar = (snackTitle: string, snackMessage: string) => {
    const key = enqueueSnackbar(
      <Snackbar title={snackTitle} subTitle={<AddCreditsSnackbarContent message={snackMessage} onAction={() => closeSnackbar(key)} />} iconVariant="warning" />,
      {
        variant: "warning",
        autoHideDuration: 10000
      }
    );
  };

  return (
    <WalletProviderContext.Provider
      value={{
        address: walletAddress as string,
        walletName: username as string,
        isWalletConnected,
        isWalletLoaded,
        connectManagedWallet,
        logout,
        signAndBroadcastTx,
        isCustodial: !isManaged,
        isWalletLoading: isLoading,
        isTrialing: isManaged && !!managedWallet?.isTrialing,
        isOnboarding: !!user?.userId && isManaged && !!managedWallet?.isTrialing,
        creditAmount: isManaged ? managedWallet?.creditAmount : 0,
        topUpMinAmountUsd: managedWallet?.topUpMinAmountUsd ?? 20,
        hasManagedWallet: !!managedWallet,
        managedWalletError,
        switchWalletType,
        ...managedMarker
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
  const { isManaged: canVisit, isWalletLoading: isLoading } = useWallet();

  return { canVisit, isLoading };
}

const SUPPORT_EMAIL = "support@akash.network";

const AddCreditsSnackbarContent: React.FC<{ message?: string; onAction?: () => void }> = ({ message, onAction }) => {
  const { analyticsService } = useServices();
  return (
    <>
      {message && <div>{message}</div>}
      <Link
        href={UrlService.billing({ openPayment: true })}
        className={cn("mt-2 inline-flex h-7 items-center px-3 text-xs", buttonVariants({ variant: "default" }))}
        onClick={() => {
          analyticsService.track("add_funds_btn_clk");
          onAction?.();
        }}
      >
        Add Funds
      </Link>
    </>
  );
};

const TransactionSnackbarContent: React.FC<{ snackMessage: string; transactionHash: string; isError?: boolean }> = ({
  snackMessage,
  transactionHash,
  isError
}) => {
  const { publicConfig: appConfig } = useServices();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  const txUrl = transactionHash && `${appConfig.NEXT_PUBLIC_STATS_APP_URL}/transactions/${transactionHash}?network=${selectedNetworkId}`;

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
      {isError && (
        <div className="mt-2 text-xs">
          Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Transaction Error&body=${encodeURIComponent(snackMessage)}`} className="underline">
            Contact {SUPPORT_EMAIL}
          </a>
        </div>
      )}
    </>
  );
};
