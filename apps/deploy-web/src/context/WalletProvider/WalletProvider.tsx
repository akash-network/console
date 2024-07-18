"use client";
import React, { useMemo, useRef } from "react";
import { useEffect, useState } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { EncodeObject } from "@cosmjs/proto-signing";
import { DeliverTxResponse, SigningStargateClient } from "@cosmjs/stargate";
import { useManager } from "@cosmos-kit/react";
import axios from "axios";
import { OpenNewWindow } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { event } from "nextjs-google-analytics";
import { SnackbarKey, useSnackbar } from "notistack";

import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useAnonymousUser } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import { useAllowance } from "@src/hooks/useAllowance";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { getSelectedNetwork, useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { useWhen } from "@src/hooks/useWhen";
import { AnalyticsEvents } from "@src/utils/analytics";
import { STATS_APP_URL, uAktDenom } from "@src/utils/constants";
import { customRegistry } from "@src/utils/customRegistry";
import { UrlService } from "@src/utils/urlUtils";
import { LocalWalletDataType } from "@src/utils/walletUtils";
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
  logout: () => void;
  setIsWalletLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<any>;
  refreshBalances: (address?: string) => Promise<Balances>;
  isManaged: boolean;
};

const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

export const WalletProvider = ({ children }) => {
  const [walletBalances, setWalletBalances] = useState<Balances | null>(null);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const [isBroadcastingTx, setIsBroadcastingTx] = useState<boolean>(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState<boolean>(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const signingClient = useRef<SigningStargateClient | null>(null);
  const router = useRouter();
  const { settings } = useSettings();
  const usdcIbcDenom = useUsdcDenom();
  const userWallet = useSelectedChain();
  const { addEndpoints } = useManager();
  const {
    fee: { default: feeGranter }
  } = useAllowance();
  const { user } = useAnonymousUser();
  const { wallet: managedWallet } = useManagedWallet();
  const { address, username, isWalletConnected } = useMemo(() => managedWallet || userWallet, [managedWallet, userWallet]);

  useWhen(managedWallet, refreshBalances);

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

  async function createStargateClient() {
    const selectedNetwork = getSelectedNetwork();

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

    const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner, {
      registry: customRegistry,
      broadcastTimeoutMs: 300_000 // 5min
    });

    return client;
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
    userWallet.connect();

    await loadWallet();

    event(AnalyticsEvents.CONNECT_WALLET, {
      category: "wallet",
      label: "Connect wallet"
    });
  }

  // Update balances on wallet address change
  useEffect(() => {
    if (address) {
      loadWallet();
    }
  }, [address]);

  async function loadWallet(): Promise<void> {
    const selectedNetwork = getSelectedNetwork();
    const storageWallets = JSON.parse(localStorage.getItem(`${selectedNetwork.id}/wallets`) || "[]") as LocalWalletDataType[];

    let currentWallets = storageWallets ?? [];

    if (!currentWallets.some(x => x.address === address)) {
      currentWallets.push({ name: username || "", address: address as string, selected: true });
    }

    currentWallets = currentWallets.map(x => ({ ...x, selected: x.address === address }));

    localStorage.setItem(`${selectedNetwork.id}/wallets`, JSON.stringify(currentWallets));

    await refreshBalances();

    setIsWalletLoaded(true);
  }

  async function signAndBroadcastTx(msgs: EncodeObject[]): Promise<boolean> {
    setIsWaitingForApproval(true);
    let pendingSnackbarKey: SnackbarKey | null = null;
    const enqueueTxSnackbar = () => {
      pendingSnackbarKey = enqueueSnackbar(<Snackbar title="Broadcasting transaction..." subTitle="Please wait a few seconds" showLoading />, {
        variant: "info",
        autoHideDuration: null
      });
    };
    let txResult: DeliverTxResponse;

    try {
      if (user && managedWallet) {
        const messages = msgs.map(m => ({ ...m, value: Buffer.from(customRegistry.encode(m)).toString("base64") }));

        enqueueTxSnackbar();
        const { data } = await axios.post("http://localhost:3080/v1/tx", {
          userId: user.id,
          messages: messages
        });
        txResult = data;
      } else {
        const estimatedFees = await userWallet.estimateFee(msgs);
        const txRaw = await userWallet.sign(msgs, {
          ...estimatedFees,
          granter: feeGranter
        });

        setIsWaitingForApproval(false);
        setIsBroadcastingTx(true);
        enqueueTxSnackbar();
        txResult = await userWallet.broadcast(txRaw);

        setIsBroadcastingTx(false);

        await refreshBalances();
      }

      if (txResult.code !== 0) {
        throw new Error(txResult.rawLog);
      }

      showTransactionSnackbar("Transaction success!", "", txResult.transactionHash, "success");

      event(AnalyticsEvents.SUCCESSFUL_TX, {
        category: "transactions",
        label: "Successful transaction"
      });

      return true;
    } catch (err) {
      console.error(err);

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

      return false;
    } finally {
      if (pendingSnackbarKey) {
        closeSnackbar(pendingSnackbarKey);
      }

      setIsWaitingForApproval(false);
      setIsBroadcastingTx(false);
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
    if (managedWallet) {
      const walletBalances = {
        uakt: 0,
        usdc: managedWallet.creditAmount
      };

      setWalletBalances(walletBalances);

      return walletBalances;
    }

    const _address = address;
    const client = await getStargateClient();

    if (client) {
      const balances = await client.getAllBalances(_address as string);
      const uaktBalance = balances.find(b => b.denom === uAktDenom);
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
        address: address as string,
        walletName: username as string,
        walletBalances,
        isWalletConnected: isWalletConnected,
        isWalletLoaded: isWalletLoaded,
        connectWallet,
        logout,
        setIsWalletLoaded,
        signAndBroadcastTx,
        refreshBalances,
        isManaged: !!managedWallet?.isWalletConnected
      }}
    >
      {children}

      <TransactionModal open={isWaitingForApproval || isBroadcastingTx} state={isWaitingForApproval ? "waitingForApproval" : "broadcasting"} />
    </WalletProviderContext.Provider>
  );
};

// Hook
export function useWallet() {
  return { ...React.useContext(WalletProviderContext) };
}

const TransactionSnackbarContent = ({ snackMessage, transactionHash }) => {
  const selectedNetwork = useSelectedNetwork();
  const txUrl = transactionHash && `${STATS_APP_URL}/transactions/${transactionHash}?network=${selectedNetwork.id}`;

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
