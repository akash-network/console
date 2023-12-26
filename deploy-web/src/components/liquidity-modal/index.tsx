import React, { useCallback, useMemo } from "react";
import {
  LiquidityModal as LeapLiquidityModal,
  Tabs,
  TxnSummary,
  defaultBlurs,
  useInitCachingLayer,
  AsyncIDBStorage,
  ErrorBoundary
} from "@leapwallet/elements";
import type { ThemeDefinition, WalletClient, AssetSelector, AllowedDestinationChainConfig } from "@leapwallet/elements";
import type { StdSignDoc } from "@cosmjs/amino";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { useWallet } from "@src/context/WalletProvider";
import Button from "@mui/material/Button";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";

const theme: ThemeDefinition = {
  colors: {
    primary: "#E85A39",
    primaryButton: "#E85A39",
    border: "#282828",
    stepBorder: "#383838",
    backgroundPrimary: "#212121",
    backgroundSecondary: "#141414",
    text: "#ffffff",
    textSecondary: "#9E9E9E",
    primaryButtonText: "#ffffff",
    alpha: "#D6D6D6",
    gray: "#9E9E9E",
    error: "#ff6961",
    errorBackground: "#272727",
    success: "#29A874",
    successBackground: "#0D3525",
    warning: "#ffa726"
  },
  zIndices: {
    modalOverlay: "1200"
  },
  borderRadii: {
    actionButton: "1rem",
    connectWalletButton: "0.5rem",
    logo: "99rem",
    modalBody: "0.75rem",
    primary: "0.6rem",
    secondary: "0.3rem",
    selector: "99rem",
    tabBody: "0.5rem",
    tabButton: "0.25rem"
  },
  blurs: defaultBlurs,
  fontFamily: `"Inter", sans-serif`
};

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
    .format(amount)
    .slice(1);
};

const osmosisChainId = "osmosis-1";
const akashnetChainId = "akashnet-2";
const aktSelector: AssetSelector = ["denom", "uakt"];
const allowedDestinationChains: AllowedDestinationChainConfig[] = [
  {
    chainId: akashnetChainId,
    assetDenoms: ["uakt", "uusd"]
  }
];

const ToggleLiquidityModalButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const _onClick = () => {
    event(AnalyticsEvents.LEAP_GET_MORE_TOKENS, {
      category: "wallet",
      label: "Open Leap liquidity modal"
    });

    onClick();
  };
  return (
    <Button variant="contained" color="secondary" onClick={_onClick}>
      Get More
    </Button>
  );
};

const LiquidityModal: React.FC<{ address: string; aktBalance: number; refreshBalances: () => void }> = ({ address, aktBalance, refreshBalances }) => {
  useInitCachingLayer(AsyncIDBStorage);

  const { isLeapInstalled, isKeplrInstalled, isWalletConnected } = useWallet();

  const handleConnectWallet = useCallback(
    (chainId?: string) => {
      if (!isWalletConnected) {
        if (isLeapInstalled) {
          return window.wallet.enable(chainId);
        } else if (isKeplrInstalled) {
          return window.keplr.enable(chainId);
        } else {
          throw new Error("No wallet installed");
        }
      }
    },
    [isWalletConnected, isLeapInstalled, isKeplrInstalled]
  );

  const walletClient: WalletClient = {
    enable: (chainIds: string | string[]) => {
      return window.wallet.enable(chainIds);
    },
    getAccount: async (chainId: string) => {
      await window.wallet.enable(chainId);
      const walletKey = await window.wallet.getKey?.(chainId);
      if (!walletKey) {
        throw new Error("Failed to get connected wallet information");
      }
      return {
        bech32Address: walletKey.bech32Address,
        pubKey: walletKey.pubKey,
        isNanoLedger: walletKey.isNanoLedger
      };
    },
    // @ts-expect-error Due to some issue with the `Long` type for accountNumber in the signed object
    getSigner: async (chainId: string) => {
      const offlineSigner = await window.wallet.getOfflineSigner(chainId);
      if (!offlineSigner) {
        throw new Error("Failed to get connected wallet signer");
      }
      return {
        signDirect: async (address: string, signDoc: SignDoc) => {
          const result = await offlineSigner.signDirect(address, signDoc);
          return {
            signed: result.signed,
            signature: Uint8Array.from(Buffer.from(result.signature.signature, "base64"))
          };
        },
        signAmino: async (address: string, signDoc: StdSignDoc) => {
          const result = await offlineSigner.signAmino(address, signDoc);
          return {
            signed: result.signed,
            signature: Uint8Array.from(Buffer.from(result.signature.signature, "base64"))
          };
        }
      };
    }
  };

  const handleTxnComplete = useCallback((summary: TxnSummary) => {
    if (summary.destinationChain.chainId === akashnetChainId) {
      if (summary.summaryType === "skip" || summary.summaryType === "squid") {
        const denom = summary.destinationAsset.originDenom;
        if (denom === "uakt") {
          refreshBalances();
        }

        event(AnalyticsEvents.LEAP_TRANSACTION_COMPLETE, {
          category: "wallet",
          label: "Completed a transaction on Leap liquidity modal"
        });
      }
    }
  }, []);

  const walletClientConfig = useMemo(() => {
    return {
      userAddress: address,
      walletClient: walletClient,
      connectWallet: handleConnectWallet
    };
  }, [address, walletClient, handleConnectWallet]);

  const modalConfig = useMemo(() => {
    return {
      icon: "https://assets.leapwallet.io/akt.png",
      subtitle: `You need only ${formatAmount(5 - aktBalance)} more AKT to get started!`,
      title: "Get AKT",
      tabsConfig: {
        [Tabs.SWAP]: {
          allowedDestinationChains,
          defaults: {
            sourceChainId: osmosisChainId,
            destinationChainId: akashnetChainId,
            destinationAssetSelector: aktSelector
          }
        },
        [Tabs.CROSS_CHAIN_SWAPS]: {
          allowedDestinationChains,
          defaults: {
            destinationChainId: akashnetChainId,
            destinationAssetSelector: aktSelector
          }
        },
        [Tabs.BRIDGE_USDC]: {
          enabled: false
        },
        [Tabs.TRANSFER]: {
          enabled: false
        },
        [Tabs.FIAT_ON_RAMP]: {
          enabled: false
        }
      }
    };
  }, [aktBalance]);

  return (
    <ErrorBoundary>
      <LeapLiquidityModal
        theme={theme}
        walletClientConfig={walletClientConfig}
        onTxnComplete={handleTxnComplete}
        config={modalConfig}
        renderLiquidityButton={ToggleLiquidityModalButton}
      />
    </ErrorBoundary>
  );
};

export default LiquidityModal;

