"use client";
import React, { useRef } from "react";
import { useEffect, useState } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { EncodeObject } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { useChainWallet, useManager } from "@cosmos-kit/react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { SnackbarKey, useSnackbar } from "notistack";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";

import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { uAktDenom } from "@src/utils/constants";
import { customRegistry } from "@src/utils/customRegistry";
import { UrlService } from "@src/utils/urlUtils";
import { LocalWalletDataType } from "@src/utils/walletUtils";
import { useSelectedChain } from "../CustomChainProvider";
import { useSettings } from "../SettingsProvider";
import { jwtDecode } from "jwt-decode";
import { checkAndRefreshToken } from "@src/utils/tokenUtils";
import restClient from "@src/utils/restClient";
import { getNonceMessage } from "@src/utils/walletUtils";
import authClient from "@src/utils/authClient";

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
  isWalletArbitrarySigned: boolean;
  connectWallet: () => Promise<void>;
  logout: () => void;
  setIsWalletLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  setIsWalletArbitrarySigned: React.Dispatch<React.SetStateAction<boolean>>;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<any>;
  refreshBalances: (address?: string) => Promise<Balances>;
  isProvider: boolean;
  isOnline: boolean;
  provider: any; // Replace 'any' with a more specific type if available
  isProviderStatusFetched: boolean;
  isProviderOnlineStatusFetched: boolean;
  handleArbitrarySigning: () => Promise<void>;
};

const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

export const WalletProvider = ({ children }) => {
  const [walletBalances, setWalletBalances] = useState<Balances | null>(null);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const [isWalletProvider, setIsWalletProvider] = useState<boolean>(false);
  const [isWalletProviderOnline, setIsWalletProviderOnline] = useState<boolean>(false);
  const [isProviderOnlineStatusFetched, setIsProviderOnlineStatusFetched] = useState<boolean>(false);
  const [provider, setProvider] = useState<any>(null);
  const [isProviderStatusFetched, setIsProviderStatusFetched] = useState<boolean>(false);
  const [isBroadcastingTx, setIsBroadcastingTx] = useState<boolean>(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState<boolean>(false);
  const [isWalletArbitrarySigned, setIsWalletArbitrarySigned] = useState<boolean>(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const sigingClient = useRef<SigningStargateClient | null>(null);
  const router = useRouter();
  const { settings } = useSettings();
  const usdcIbcDenom = useUsdcDenom();
  const {
    disconnect,
    getOfflineSigner,
    isWalletConnected,
    address: walletAddress,
    connect,
    username,
    estimateFee,
    sign,
    broadcast,
    wallet,
    signArbitrary
  } = useSelectedChain();
  const { addEndpoints } = useManager();
  const selectedNetwork = useSelectedNetwork();
  useEffect(() => {
    if (!settings.apiEndpoint || !settings.rpcEndpoint) return;

    addEndpoints({
      akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
    });
  }, [settings.apiEndpoint, settings.rpcEndpoint]);

  useEffect(() => {
    (async () => {
      if (settings?.rpcEndpoint && isWalletConnected) {
        sigingClient.current = await createStargateClient();

        try {
          const validAccessToken = await checkAndRefreshToken();
          if (validAccessToken) {
            console.log("Access token is valid");
            setIsWalletArbitrarySigned(true);
            await fetchProviderStatus();
          } else {
            console.log("No valid access token found");
            setIsWalletArbitrarySigned(false);
          }
        } catch (error) {
          console.error("Error checking or refreshing token:", error);
          setIsWalletArbitrarySigned(false);
          logout(); // Force logout if refresh fails
        }
      }
    })();
  }, [settings?.rpcEndpoint, isWalletConnected]);

  const fetchProviderStatus = async () => {
    try {
      const isProviderResponse: any = await restClient.get(`/provider/status/onchain?chainid=${selectedNetwork.chainId}`);
      setIsWalletProvider(isProviderResponse.provider ? true : false);
      setProvider(isProviderResponse.provider);
      setIsProviderStatusFetched(true);
      if (isProviderResponse.provider) {
        const isOnlineResponse: any = await restClient.get(`/provider/status/online?chainid=${selectedNetwork.chainId}`);
        setIsProviderOnlineStatusFetched(true);
        setIsWalletProviderOnline(isOnlineResponse.online);
      }
    } catch (error) {
      console.error("Error fetching provider status:", error);
    }
  };

  async function createStargateClient() {
    const selectedNetwork = getSelectedNetwork();

    const offlineSigner: any = getOfflineSigner();
    let rpc = settings?.rpcEndpoint ? settings?.rpcEndpoint : (selectedNetwork.rpcEndpoint as string);

    try {
      await axios.get(`${rpc}/abci_info`);
    } catch (error) {
      // If the rpc node has cors enabled, switch to the backup rpc cosmos.directory
      if (error.code === "ERR_NETWORK" || error?.response?.status === 0) {
        rpc = selectedNetwork.rpcEndpoint as string;
      }
    }

    const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner);

    return client;
  }

  async function getStargateClient() {
    if (!sigingClient.current) {
      sigingClient.current = await createStargateClient();
    }

    return sigingClient.current;
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("walletAddress");
    setWalletBalances(null);
    disconnect();
    setIsWalletArbitrarySigned(false);
    setIsProviderStatusFetched(false);
    setIsProviderOnlineStatusFetched(false);
    setIsWalletProvider(false);
    setIsWalletProviderOnline(false);
    setProvider(null);
    router.push(UrlService.home());
  }

  async function connectWallet() {
    console.log("Connecting wallet with CosmosKit...");
    await connect();
    // console.log("Connected wallet with CosmosKit");
    // await loadWallet();
    // await handleArbitrarySigning();
    // console.log("Wallet address", walletAddress);
  }

  async function handleArbitrarySigning() {
    console.log("Access token", localStorage.getItem("accessToken"));
    console.log("Wallet address", walletAddress);
    if (!localStorage.getItem("accessToken") && walletAddress) {
      console.log("Handling arbitrary signing");
      try {
        const response: any = await authClient.get(`users/nonce/${walletAddress}`);
        if (response?.data?.nonce) {
          const message = getNonceMessage(response.data.nonce, walletAddress);

          // const signArbitrary = username === "leap-extension" ? leapSignArbitrary : keplrSignArbitrary;
          // const signArbitrary = wallet?.name === "leap-extension" ? leapSignArbitrary : keplrSignArbitrary;

          const result = await signArbitrary(walletAddress, message);

          if (result) {
            const verifySign = await authClient.post("auth/verify", { signer: walletAddress, ...result });
            if (verifySign.data) {
              localStorage.setItem("accessToken", verifySign.data.access_token);
              localStorage.setItem("refreshToken", verifySign.data.refresh_token);
              localStorage.setItem("walletAddress", walletAddress);
              setIsWalletArbitrarySigned(true);
            } else {
              throw new Error("Verification failed");
            }
          } else {
            throw new Error("Signing failed");
          }
        } else {
          if (response.status === "error" && response.error.code === "N4040") {
            await authClient.post("users", { address: walletAddress });
            await handleArbitrarySigning();
          } else {
            throw new Error("Invalid nonce response");
          }
        }
      } catch (error) {
        console.error("Error during arbitrary signing:", error);
        logout();
        setIsWalletArbitrarySigned(false);
      }
    }
  }

  // Update balances on wallet address change
  useEffect(() => {
    if (walletAddress) {
      loadWallet();
      handleArbitrarySigning();
    }
  }, [walletAddress]);

  async function loadWallet(): Promise<void> {
    const selectedNetwork = getSelectedNetwork();
    console.log("selectedNetwork", selectedNetwork);
    const storageWallets = JSON.parse(localStorage.getItem(`${selectedNetwork.id}/wallets`) || "[]") as LocalWalletDataType[];

    let currentWallets = storageWallets ?? [];

    if (!currentWallets.some(x => x.address === walletAddress)) {
      currentWallets.push({ name: username || "", address: walletAddress as string, selected: true });
    }

    currentWallets = currentWallets.map(x => ({ ...x, selected: x.address === walletAddress }));

    localStorage.setItem(`${selectedNetwork.id}/wallets`, JSON.stringify(currentWallets));

    await refreshBalances();

    setIsWalletLoaded(true);
  }

  async function signAndBroadcastTx(msgs: EncodeObject[]): Promise<boolean> {
    setIsWaitingForApproval(true);
    let pendingSnackbarKey: SnackbarKey | null = null;
    try {
      const estimatedFees = await estimateFee(msgs);
      const txRaw = await sign(msgs, {
        ...estimatedFees
        // granter: feeGranter
      });

      setIsWaitingForApproval(false);
      setIsBroadcastingTx(true);

      pendingSnackbarKey = enqueueSnackbar(<Snackbar title="Broadcasting transaction..." subTitle="Please wait a few seconds" showLoading />, {
        variant: "info",
        autoHideDuration: null
      });

      const txResult = await broadcast(txRaw);

      setIsBroadcastingTx(false);

      if (txResult.code !== 0) {
        throw new Error(txResult.rawLog);
      }

      showTransactionSnackbar("Transaction success!", "", txResult.transactionHash, "success");

      await refreshBalances();

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

            if (codeSpace === "sdk") {
              const errorMessages = {
                5: "Insufficient funds",
                9: "Unknown address",
                11: "Out of gas",
                12: "Memo too large",
                13: "Insufficient fee",
                19: "Tx already in mempool",
                25: "Invalid gas adjustment"
              };

              if (code in errorMessages) {
                errorMsg = errorMessages[code];
              }
            }
          }

          if (log) {
            errorMsg += `. ${log}`;
          }
        } catch (err) {
          console.error(err);
        }
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
    enqueueSnackbar(<Snackbar title={snackTitle} iconVariant={snackVariant} />, {
      variant: snackVariant,
      autoHideDuration: 10000
    });
  };

  async function refreshBalances(address?: string): Promise<{ uakt: number; usdc: number }> {
    const _address = address || walletAddress;
    const client = await getStargateClient();

    console.log("client", client);
    // console.log("address", _address);
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
        address: walletAddress as string,
        walletName: username as string,
        walletBalances,
        isWalletArbitrarySigned,
        setIsWalletArbitrarySigned,
        isWalletConnected: isWalletConnected,
        isWalletLoaded,
        connectWallet,
        logout,
        setIsWalletLoaded,
        signAndBroadcastTx,
        refreshBalances,
        isProvider: isWalletProvider,
        isOnline: isWalletProviderOnline,
        provider: provider,
        isProviderStatusFetched,
        isProviderOnlineStatusFetched,
        handleArbitrarySigning
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
