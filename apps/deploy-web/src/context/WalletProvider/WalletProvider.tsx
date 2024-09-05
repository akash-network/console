"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TxOutput } from "@akashnetwork/http-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { EncodeObject } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { useManager } from "@cosmos-kit/react";
import axios from "axios";
import { OpenNewWindow } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { event } from "nextjs-google-analytics";
import { SnackbarKey, useSnackbar } from "notistack";

import { LoadingState, TransactionModal } from "@src/components/layout/TransactionModal";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { UAKT_DENOM } from "@src/config/denom.config";
import { useAllowance } from "@src/hooks/useAllowance";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { txHttpService } from "@src/services/http/http.service";
import networkStore from "@src/store/networkStore";
import { AnalyticsEvents } from "@src/utils/analytics";
import { customRegistry } from "@src/utils/customRegistry";
import { UrlService } from "@src/utils/urlUtils";
import { getSelectedStorageWallet, getStorageWallets, updateStorageManagedWallet, updateStorageWallets } from "@src/utils/walletUtils";
import { useSelectedChain } from "../CustomChainProvider";
import { useSettings } from "../SettingsProvider";

const ERROR_MESSAGES = {
  5: "Insufficient funds",
  9: "Unknown address",
  11: "Out of gas",
  12: "Memo too large",
  13: "Insufficient fee",
  19: "Tx already in mempool",
  25: "Invalid gas adjustment"
};

type Balances = {
  uakt: number;
  usdc: number;
};

type ContextType = {
  address: string;
  walletName: string;
  walletBalances: Balances | null;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectWallet: () => Promise<void>;
  connectManagedWallet: () => void;
  logout: () => void;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<any>;
  refreshBalances: (address?: string) => Promise<Balances>;
  isManaged: boolean;
  isWalletLoading: boolean;
  isTrialing: boolean;
  creditAmount?: number;
  switchWalletType: () => void;
  hasManagedWallet: boolean;
};

const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

const MESSAGE_STATES: Record<string, LoadingState> = {
  "/akash.deployment.v1beta3.MsgCloseDeployment": "closingDeployment",
  "/akash.deployment.v1beta3.MsgCreateDeployment": "searchingProviders",
  "/akash.market.v1beta4.MsgCreateLease": "creatingDeployment",
  "/akash.deployment.v1beta3.MsgUpdateDeployment": "updatingDeployment"
};

const initialWallet = getSelectedStorageWallet();

export const WalletProvider = ({ children }) => {
  const [walletBalances, setWalletBalances] = useState<Balances | null>(null);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const signingClient = useRef<SigningStargateClient | null>(null);
  const router = useRouter();
  const { settings } = useSettings();
  const usdcIbcDenom = useUsdcDenom();
  const user = useUser();
  const userWallet = useSelectedChain();
  const { wallet: managedWallet, isLoading, create: createManagedWallet, refetch } = useManagedWallet();
  const [selectedWalletType, selectWalletType] = useState<"managed" | "custodial">(
    initialWallet?.selected && initialWallet?.isManaged ? "managed" : "custodial"
  );
  const {
    address: walletAddress,
    username,
    isWalletConnected
  } = useMemo(() => (selectedWalletType === "managed" && managedWallet) || userWallet, [managedWallet, userWallet, selectedWalletType]);
  const { addEndpoints } = useManager();
  const isManaged = useMemo(() => !!managedWallet && managedWallet?.address === walletAddress, [walletAddress, managedWallet]);

  const {
    fee: { default: feeGranter }
  } = useAllowance(walletAddress as string, isManaged);

  useWhen(isManaged, refreshBalances);

  useEffect(() => {
    if (!settings.apiEndpoint || !settings.rpcEndpoint) return;

    addEndpoints({
      akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
    });
  }, [addEndpoints, settings.apiEndpoint, settings.rpcEndpoint]);

  useEffect(() => {
    (async () => {
      if (settings?.rpcEndpoint && userWallet.isWalletConnected) {
        signingClient.current = await createStargateClient();
      }
    })();
  }, [settings?.rpcEndpoint, userWallet.isWalletConnected]);

  function switchWalletType() {
    if (selectedWalletType === "custodial" && !managedWallet) {
      userWallet.disconnect();
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

    selectWalletType(prev => (prev === "custodial" ? "managed" : "custodial"));
  }

  function connectManagedWallet() {
    if (managedWallet) {
      selectWalletType("managed");
    } else {
      createManagedWallet();
    }
  }

  async function createStargateClient() {
    const selectedNetwork = networkStore.getSelectedNetwork();

    const offlineSigner = userWallet.getOfflineSigner();
    let rpc = settings?.rpcEndpoint ? settings?.rpcEndpoint : (selectedNetwork.rpcEndpoint as string);

    try {
      await axios.get(`${rpc}/abci_info`);
    } catch (error) {
      // If the rpc node has cors enabled, switch to the backup rpc cosmos.directory
      if (error.code === "ERR_NETWORK" || error?.response?.status === 0) {
        rpc = selectedNetwork.rpcEndpoint as string;
      }
    }

    return await SigningStargateClient.connectWithSigner(rpc, offlineSigner, {
      registry: customRegistry,
      broadcastTimeoutMs: 300_000 // 5min
    });
  }

  async function getStargateClient() {
    if (!signingClient.current) {
      signingClient.current = await createStargateClient();
    }

    return signingClient.current;
  }

  function logout() {
    setWalletBalances(null);
    userWallet.disconnect();

    event(AnalyticsEvents.DISCONNECT_WALLET, {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(UrlService.home());
  }

  async function connectWallet() {
    console.log("Connecting wallet with CosmosKit...");
    await userWallet.connect();

    await loadWallet();

    event(AnalyticsEvents.CONNECT_WALLET, {
      category: "wallet",
      label: "Connect wallet"
    });
  }

  useWhen(walletAddress, loadWallet);

  async function loadWallet(): Promise<void> {
    let currentWallets = getStorageWallets();

    if (!currentWallets.some(x => x.address === walletAddress)) {
      currentWallets.push({ name: username || "", address: walletAddress as string, selected: true, isManaged: false });
    }

    currentWallets = currentWallets.map(x => ({ ...x, selected: x.address === walletAddress }));

    updateStorageWallets(currentWallets);
    await refreshBalances();

    setIsWalletLoaded(true);
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

      event(AnalyticsEvents.SUCCESSFUL_TX, {
        category: "transactions",
        label: "Successful transaction"
      });

      return true;
    } catch (err) {
      console.error(err);

      if (axios.isAxiosError(err) && err.response?.status !== 500) {
        const [title, message] = err.response?.data?.message.split(": ") ?? [];
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
                errorMsg = ERROR_MESSAGES[code];
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
          event(AnalyticsEvents.FAILED_TX, {
            category: "transactions",
            label: "Failed transaction"
          });
        }

        showTransactionSnackbar("Transaction has failed...", errorMsg, transactionHash, "error");
      }

      return false;
    } finally {
      await refreshBalances();
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

  async function refreshBalances(address?: string): Promise<{ uakt: number; usdc: number }> {
    if (isManaged && managedWallet) {
      const wallet = await refetch();
      const walletBalances = {
        uakt: 0,
        usdc: wallet.data?.creditAmount || managedWallet.creditAmount
      };

      setWalletBalances(walletBalances);

      return walletBalances;
    }

    const _address = address || walletAddress;
    const client = await getStargateClient();

    if (client) {
      const balances = await client.getAllBalances(_address as string);
      const uaktBalance = balances.find(b => b.denom === UAKT_DENOM);
      const usdcBalance = balances.find(b => b.denom === usdcIbcDenom);

      const walletBalances = {
        uakt: uaktBalance ? parseInt(uaktBalance.amount) : 0,
        usdc: usdcBalance ? parseInt(usdcBalance.amount) : 0
      };

      setWalletBalances(walletBalances);

      return walletBalances;
    } else {
      return {
        uakt: 0,
        usdc: 0
      };
    }
  }

  return (
    <WalletProviderContext.Provider
      value={{
        address: walletAddress as string,
        walletName: username as string,
        walletBalances,
        isWalletConnected: isWalletConnected,
        isWalletLoaded: isWalletLoaded,
        connectWallet,
        connectManagedWallet,
        logout,
        signAndBroadcastTx,
        refreshBalances,
        isManaged,
        isWalletLoading: isLoading,
        isTrialing: isManaged && !!managedWallet?.isTrialing,
        creditAmount: isManaged ? managedWallet?.creditAmount : 0,
        hasManagedWallet: !!managedWallet,
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

const TransactionSnackbarContent = ({ snackMessage, transactionHash }) => {
  const selectedNetwork = networkStore.useSelectedNetwork();
  const txUrl = transactionHash && `${browserEnvConfig.NEXT_PUBLIC_STATS_APP_URL}/transactions/${transactionHash}?network=${selectedNetwork.id}`;

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
