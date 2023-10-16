import React, { useRef } from "react";
import { useState, useEffect } from "react";
import { SigningStargateClient } from "@cosmjs/stargate";
import { uAktDenom } from "@src/utils/constants";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { EncodeObject } from "@cosmjs/proto-signing";
import { useSnackbar } from "notistack";
import { Snackbar } from "@src/components/shared/Snackbar";
import { customRegistry } from "@src/utils/customRegistry";
import { TransactionModal } from "@src/components/layout/TransactionModal";
import { OpenInNew, WindowSharp } from "@mui/icons-material";
import { useTheme } from "@mui/material";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { useSettings } from "../SettingsProvider";
import axios from "axios";
import { LinkTo } from "@src/components/shared/LinkTo";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";

type Balances = {
  uakt: number;
  usdc: number;
};

type ContextType = {
  address: string;
  walletName: string;
  walletBalances: Balances;
  isLeapInstalled: boolean;
  isKeplrInstalled: boolean;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectWallet: (walletSource: Wallets) => Promise<void>;
  logout: () => void;
  setIsWalletLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<any>;
  refreshBalances: (address?: string) => Promise<Balances>;
};

export enum Wallets {
  KEPLR = "keplr",
  LEAP = "leap"
}

const WalletProviderContext = React.createContext<ContextType>({
  address: null,
  walletName: null,
  walletBalances: null,
  isLeapInstalled: false,
  isKeplrInstalled: false,
  isWalletConnected: false,
  isWalletLoaded: false,
  connectWallet: null,
  logout: null,
  setIsWalletLoaded: null,
  signAndBroadcastTx: null,
  refreshBalances: null
});

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string>(null);
  const [walletName, setWalletName] = useState<string>(null);
  const [walletBalances, setWalletBalances] = useState<Balances>(null);
  const [isKeplrInstalled, setIsKeplrInstalled] = useState<boolean>(false);
  const [isLeapInstalled, setIsLeapInstalled] = useState<boolean>(false);
  const [isWindowLoaded, setIsWindowLoaded] = useState<boolean>(false);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(false);
  const [isBroadcastingTx, setIsBroadcastingTx] = useState<boolean>(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const isMounted = useRef(true);
  const sigingClient = useRef<SigningStargateClient>(null);
  const router = useRouter();
  const { settings, isSettingsInit } = useSettings();
  const usdcIbcDenom = useUsdcDenom();

  useEffect(() => {
    console.log("useWallet on mount");

    if (document.readyState === "complete") {
      setIsWindowLoaded(true);
    } else {
      const onLoad = () => {
        setIsWindowLoaded(true);
      };
      window.addEventListener("load", onLoad);
      // Remove the event listener when component unmounts
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  useEffect(() => {
    if (isWindowLoaded && isSettingsInit) {
      if (!!window.keplr || !!window.leap) {
        if (!!window.keplr) {
          setIsKeplrInstalled(true);
        }

        if (!!window.leap) {
          setIsLeapInstalled(true);
        }

        if (localStorage.getItem("wallet_autoconnect")) {
          const storedWallet = localStorage.getItem("wallet_autoconnect");

          if (storedWallet === Wallets.KEPLR) {
            window.wallet = window.keplr;
          } else if (storedWallet === Wallets.LEAP) {
            window.wallet = window.leap;
          }

          window.wallet.defaultOptions = {
            sign: {
              preferNoSetMemo: true
            }
          };

          loadWallet();
        } else {
          setIsWalletLoaded(true);
        }

        const keplrOnKeystoreChange = () => onKeystoreChange(Wallets.KEPLR);
        const leapOnKeystoreChange = () => onKeystoreChange(Wallets.LEAP);
        window.addEventListener("keplr_keystorechange", keplrOnKeystoreChange);
        window.addEventListener("leap_keystorechange", leapOnKeystoreChange);

        return () => {
          isMounted.current = false;

          window.removeEventListener("keplr_keystorechange", keplrOnKeystoreChange);
          window.removeEventListener("leap_keystorechange", leapOnKeystoreChange);
        };
      } else {
        setIsWalletLoaded(true);
      }
    }
  }, [isWindowLoaded, isSettingsInit]);

  useEffect(() => {
    if (settings?.rpcEndpoint && sigingClient.current) {
      sigingClient.current = null;
    }
  }, [settings?.rpcEndpoint]);

  const onKeystoreChange = (wallet: Wallets) => {
    console.log(`Key store in ${wallet} is changed.`);

    loadWallet();

    router.push(UrlService.home());
  };

  async function createStargateClient() {
    const selectedNetwork = getSelectedNetwork();

    const offlineSigner = window.wallet.getOfflineSigner(selectedNetwork.chainId);
    let rpc = settings?.rpcEndpoint ? settings?.rpcEndpoint : selectedNetwork.rpcEndpoint;

    try {
      await axios.get(`${rpc}/abci_info`);
    } catch (error) {
      // If the rpc node has cors enabled, switch to the backup rpc cosmos.directory
      if (error.code === "ERR_NETWORK" || error?.response?.status === 0) {
        rpc = selectedNetwork.rpcEndpoint;
      }
    }

    const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner, {
      registry: customRegistry,
      broadcastTimeoutMs: 300_000 // 5min
    });

    return client;
  }

  async function getStargateClient() {
    if (!sigingClient.current) {
      sigingClient.current = await createStargateClient();
    }

    return sigingClient.current;
  }

  function logout(): void {
    setWalletAddress(null);
    setWalletName(null);
    setWalletBalances(null);

    localStorage.removeItem("wallet_autoconnect");

    event(AnalyticsEvents.DISCONNECT_WALLET, {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(UrlService.home());
  }

  async function connectWallet(walletSource: Wallets): Promise<void> {
    console.log(`connecting to ${walletSource}`);

    window.wallet = window[walletSource];
    const selectedNetwork = getSelectedNetwork();

    if (selectedNetwork.suggestWalletChain) {
      await selectedNetwork.suggestWalletChain();
    }

    await window.wallet.enable(selectedNetwork.chainId);

    await loadWallet();

    event(AnalyticsEvents.CONNECT_WALLET, {
      category: "wallet",
      label: "Connect wallet"
    });

    localStorage.setItem("wallet_autoconnect", walletSource);
  }

  async function loadWallet(): Promise<void> {
    let wallet = null;
    let selectedNetwork = null;
    try {
      selectedNetwork = getSelectedNetwork();
      wallet = await window.wallet.getKey(selectedNetwork.chainId);
    } catch (err) {
      console.error(err);

      if (err.message.includes("There is no chain info for")) {
        await selectedNetwork?.suggestWalletChain();
        wallet = await window.wallet.getKey(selectedNetwork.chainId);
      } else {
        setIsWalletLoaded(true);
        return;
      }
    }

    if (!isMounted.current) return;

    const address = wallet?.bech32Address;
    const selectedNetworkId = localStorage.getItem("selectedNetworkId");
    const storageWallets = JSON.parse(localStorage.getItem(`${selectedNetworkId}/wallets`));

    const currentWallets = storageWallets ? [...storageWallets] : [];
    const newWallets =
      currentWallets.findIndex(x => x.address === address) === -1 ? [...currentWallets].concat({ name: wallet?.name, address }) : [...currentWallets];

    for (let i = 0; i < newWallets.length; i++) {
      newWallets[i].selected = newWallets[i].address === address;
    }

    localStorage.setItem(`${selectedNetworkId}/wallets`, JSON.stringify(newWallets));

    setWalletAddress(address);
    setWalletName(wallet.name);

    await refreshBalances(address);

    setIsWalletLoaded(true);
  }

  async function signAndBroadcastTx(msgs: EncodeObject[]): Promise<boolean> {
    setIsBroadcastingTx(true);
    let pendingSnackbarKey = null;
    try {
      const client = await getStargateClient();
      const simulation = await client.simulate(walletAddress, msgs, "");
      const txRaw = await client.sign(
        walletAddress,
        msgs,
        {
          amount: [
            {
              amount: "0.025",
              denom: uAktDenom
            }
          ],
          gas: Math.ceil(simulation * 1.25).toString()
        },
        ""
      );

      pendingSnackbarKey = enqueueSnackbar(<Snackbar title="Broadcasting transaction..." subTitle="Please wait a few seconds" showLoading />, {
        variant: "info",
        autoHideDuration: null
      });

      const txRawBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
      const txResult = await client.broadcastTx(txRawBytes);

      if (txResult.code !== 0) {
        throw new Error(txResult.rawLog);
      }

      showTransactionSnackbar("Transaction success!", "", txResult.transactionHash, "success");

      event(AnalyticsEvents.SUCCESSFUL_TX, {
        category: "transactions",
        label: "Successful transaction"
      });

      await refreshBalances();

      return true;
    } catch (err) {
      console.error(err);

      const transactionHash = err.txHash;
      let errorMsg = "An error has occured";

      if (err.message.includes("was submitted but was not yet found on the chain")) {
        errorMsg = "Transaction timeout";
      } else {
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

      setIsBroadcastingTx(false);
    }
  }

  const showTransactionSnackbar = (snackTitle, snackMessage, transactionHash, snackVariant) => {
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
    const _address = address || walletAddress;
    const client = await getStargateClient();

    if (client) {
      const balances = await client.getAllBalances(_address);
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
        address: walletAddress,
        walletName,
        walletBalances,
        isKeplrInstalled,
        isLeapInstalled,
        isWalletConnected: !!walletName,
        isWalletLoaded,
        connectWallet,
        logout,
        setIsWalletLoaded,
        signAndBroadcastTx,
        refreshBalances
      }}
    >
      {children}

      <TransactionModal open={isBroadcastingTx} onClose={() => setIsBroadcastingTx(false)} />
    </WalletProviderContext.Provider>
  );
};

// Hook
export function useWallet() {
  return { ...React.useContext(WalletProviderContext) };
}

const TransactionSnackbarContent = ({ snackMessage, transactionHash }) => {
  const theme = useTheme();
  const txUrl = transactionHash && UrlService.transaction(transactionHash);

  return (
    <>
      {snackMessage}
      {snackMessage && <br />}
      {txUrl && (
        <LinkTo
          sx={{ display: "flex", alignItems: "center", color: `${theme.palette.success.contrastText}!important` }}
          onClick={() => window.open(txUrl, "_blank")}
        >
          View transaction <OpenInNew sx={{ fontSize: "1rem", marginLeft: ".5rem" }} />
        </LinkTo>
      )}
    </>
  );
};

