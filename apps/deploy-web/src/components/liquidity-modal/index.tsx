"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { useWallet as useConnectedWallet, useWalletClient } from "@cosmos-kit/react";
import {
  AsyncIDBStorage,
  ElementsProvider,
  initCachingLayer,
  LiquidityModal as LeapLiquidityModal,
  type LiquidityModalProps,
  Tabs,
  WalletType
} from "@leapwallet/elements";
import { event } from "nextjs-google-analytics";

import { useWallet } from "@src/context/WalletProvider";
import { AnalyticsEvents } from "@src/utils/analytics";

export type NonUndefined<T> = T extends undefined ? never : T;

const ToggleLiquidityModalButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const _onClick = () => {
    event(AnalyticsEvents.LEAP_GET_MORE_TOKENS, {
      category: "wallet",
      label: "Open Leap liquidity modal"
    });

    onClick();
  };

  return (
    <Button variant="default" size="sm" onClick={_onClick}>
      Get More
    </Button>
  );
};

initCachingLayer(AsyncIDBStorage);

const useConnectedWalletType = (): WalletType | undefined => {
  const { isWalletConnected } = useWallet();
  const { mainWallet } = useConnectedWallet();

  const walletName = isWalletConnected ? mainWallet?.walletName : undefined;

  const walletType = useMemo(() => {
    switch (walletName) {
      case "leap-extension":
        return WalletType.LEAP;
      case "keplr-extension":
        return WalletType.KEPLR;
      case "cosmostation-extension":
        return WalletType.COSMOSTATION;
      case "keplr-mobile":
        return WalletType.WC_KEPLR_MOBILE;
      default:
        return undefined;
    }
  }, [walletName]);

  return walletType;
};

type TabsConfig = NonUndefined<LiquidityModalProps["tabsConfig"]>;

const LiquidityModal: React.FC<{ address: string; aktBalance: number; refreshBalances: () => void }> = ({ refreshBalances }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isWalletConnected } = useWallet();
  const { client: walletClient } = useWalletClient();

  const connectedWalletType = useConnectedWalletType();

  const handleConnectWallet = useCallback(() => {
    if (!isWalletConnected && walletClient) {
      if (walletClient.enable) {
        return walletClient.enable("akashnet-2");
      } else if (walletClient.connect) {
        return walletClient.connect("akashnet-2");
      }
    } else {
      throw new Error("Wallet is not connected");
    }
  }, [isWalletConnected, walletClient]);

  const tabsConfig: TabsConfig = useMemo(() => {
    const txnLifecycleHooks = {
      onTxnComplete: () => {
        refreshBalances();
        event(AnalyticsEvents.LEAP_TRANSACTION_COMPLETE, {
          category: "wallet",
          label: "Completed a transaction on Leap liquidity modal"
        });
      }
    };

    return {
      [Tabs.SWAPS]: {
        orderIndex: 0,
        title: "Swap or Bridge",
        allowedDestinationChains: [
          {
            chainId: "akashnet-2"
          }
        ],
        defaultValues: {
          sourceChainId: "osmosis-1",
          sourceAsset: "uosmo",
          destinationChainId: "akashnet-2",
          destinationAsset: "uakt"
        },
        txnLifecycleHooks
      },
      [Tabs.IBC_SWAPS]: {
        enabled: false
      },
      [Tabs.FIAT_ON_RAMP]: {
        title: "Buy Tokens",
        orderIndex: 1,
        allowedDestinationChains: [
          {
            chainId: "akashnet-2"
          }
        ],
        defaultValues: {
          currency: "USD",
          sourceAmount: "10",
          destinationChainId: "akashnet-2",
          destinationAsset: "uakt"
        },
        onTxnComplete: txnLifecycleHooks.onTxnComplete
      },
      [Tabs.TRANSFER]: {
        orderIndex: 2,
        title: "IBC Transfer",
        defaultValues: {
          sourceChainId: "osmosis-1",
          sourceAsset: { originChainId: "akashnet-2", originDenom: "uakt" }
        },
        txnLifecycleHooks
      }
    } satisfies TabsConfig;
  }, [refreshBalances]);

  return (
    <>
      <ToggleLiquidityModalButton onClick={() => setIsOpen(o => !o)} />
      {walletClient ? (
        <div className="leap-ui">
          <ElementsProvider primaryChainId="akashnet-2" connectWallet={handleConnectWallet} connectedWalletType={connectedWalletType}>
            <LeapLiquidityModal isOpen={isOpen} setIsOpen={setIsOpen} tabsConfig={tabsConfig} defaultActiveTab={Tabs.SWAPS} />
          </ElementsProvider>
        </div>
      ) : null}
    </>
  );
};

export default LiquidityModal;
