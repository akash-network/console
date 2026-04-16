import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChainWalletBase, Wallet } from "@cosmos-kit/core";
import type { ConnectModalWalletListProps } from "@interchain-ui/react";
import { ConnectModalHead, ConnectModalWalletList } from "@interchain-ui/react";

import { useChainStore } from "../../context/ChainStoreProvider";

function getWalletProp(wallet: Wallet) {
  const { prettyName, mode, name, logo, mobileDisabled } = wallet;
  return {
    name,
    prettyName,
    logo: typeof logo === "object" ? logo.major : logo,
    mobileDisabled: typeof mobileDisabled === "boolean" ? mobileDisabled : mobileDisabled(),
    isMobile: mode === "wallet-connect"
  };
}

function DynamicWalletList({ wallets, onClose }: { wallets: ChainWalletBase[]; onClose: () => void }) {
  const chainStore = useChainStore();
  const [isLargeScreen, setIsLargeScreen] = useState(true);

  const onWalletClicked = useCallback(
    async (wallet: ChainWalletBase) => {
      chainStore.setSelectedWalletName(wallet.walletName);
      await wallet.connect(wallet.walletStatus !== "NotExist");
      if (!["Rejected", "NotExist"].includes(wallet.walletStatus)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const handleWindowResize = () => {
      setIsLargeScreen(window.innerWidth >= 768);
    };
    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  const walletsData = useMemo(
    () =>
      wallets
        .sort((a, b) => {
          if (a.walletInfo.mode !== "wallet-connect" && b.walletInfo.mode !== "wallet-connect") {
            return 0;
          } else if (a.walletInfo.mode !== "wallet-connect") {
            return -1;
          } else {
            return 1;
          }
        })
        .map((wallet, i) => ({
          ...getWalletProp(wallet.walletInfo),
          subLogo: wallet.walletInfo.mode === "wallet-connect" ? "walletConnect" : undefined,
          btmLogo: typeof wallet.walletInfo.logo === "object" ? wallet.walletInfo.logo.minor : wallet.walletInfo.extends,
          badge: ({ MetaMask: "SNAP" } as Record<string, string>)[wallet.walletInfo.extends!],
          shape: (i < 2 && isLargeScreen ? "square" : "list") as "square" | "list",
          downloadUrl: "",
          originalWallet: wallet
        })),
    [wallets, isLargeScreen]
  );

  return <ConnectModalWalletList wallets={walletsData as ConnectModalWalletListProps["wallets"]} onWalletItemClick={onWalletClicked} />;
}

export function WalletListView({ onClose, wallets }: { onClose: () => void; wallets: ChainWalletBase[] }) {
  const head = <ConnectModalHead title="Select your wallet" hasBackButton={false} onClose={onClose} />;
  const content = <DynamicWalletList wallets={wallets} onClose={onClose} />;
  return { head, content };
}
