import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChainWalletBase, ModalOptions, WalletModalProps, WalletViewProps } from "@cosmos-kit/core";
import { ModalView, State, WalletStatus } from "@cosmos-kit/core";
import { defaultModalViews } from "@cosmos-kit/react";
import type { ThemeProviderProps } from "@interchain-ui/react";
import { ConnectModal, ThemeProvider } from "@interchain-ui/react";
import { useAtomValue } from "jotai";

import { chainStore } from "@src/store/chainStore";
import { WalletListView } from "./WalletListView";

const MODAL_VIEWS = { ...defaultModalViews, WalletList: WalletListView };

type ModalCustomizationProps = {
  modalContainerClassName?: string;
  modalContentClassName?: string;
  modalChildrenClassName?: string;
  modalContentStyles?: React.CSSProperties;
};

type ThemeCustomizationProps = ModalCustomizationProps & Pick<ThemeProviderProps, "defaultTheme" | "overrides" | "themeDefs" | "customTheme">;

type WalletModalComponentProps = WalletModalProps &
  ThemeCustomizationProps & {
    modalOptions?: ModalOptions;
    includeAllWalletsOnMobile?: boolean;
  };

export function WalletModal({
  isOpen,
  setOpen,
  walletRepo,
  modalOptions,
  includeAllWalletsOnMobile,
  overrides,
  themeDefs,
  customTheme,
  defaultTheme,
  modalContainerClassName,
  modalContentClassName,
  modalChildrenClassName,
  modalContentStyles
}: WalletModalComponentProps) {
  const [currentView, setCurrentView] = useState(ModalView.WalletList);
  const [qrState, setQRState] = useState(State.Init);
  const [qrMsg, setQRMsg] = useState("");

  const disconnectOptions = {
    walletconnect: {
      removeAllPairings: modalOptions?.mobile?.displayQRCodeEveryTime
    }
  };

  walletRepo?.setCallbackOptions({
    beforeConnect: { disconnect: disconnectOptions }
  });

  const selectedWalletRepoName = useAtomValue(chainStore.selectedWalletNameAtom);
  const current: ChainWalletBase | undefined = walletRepo?.wallets.find(w => w.walletName === selectedWalletRepoName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (current?.client as any)?.setActions?.({
    qrUrl: {
      state: setQRState,
      message: setQRMsg
    }
  });

  const walletStatus = current?.walletStatus;
  const message = current?.message;

  useEffect(() => {
    if (isOpen) {
      switch (walletStatus) {
        case WalletStatus.Connecting:
          if (qrState === State.Init) {
            setCurrentView(ModalView.Connecting);
          } else {
            setCurrentView(ModalView.QRCode);
          }
          break;
        case WalletStatus.Connected:
          setCurrentView(ModalView.Connected);
          break;
        case WalletStatus.Error:
          if (qrState === State.Init) {
            setCurrentView(ModalView.Error);
          } else {
            setCurrentView(ModalView.QRCode);
          }
          break;
        case WalletStatus.Rejected:
          setCurrentView(ModalView.Rejected);
          break;
        case WalletStatus.NotExist:
          setCurrentView(prev => (prev === ModalView.Connected ? ModalView.WalletList : ModalView.NotExist));
          break;
        case WalletStatus.Disconnected:
          setCurrentView(ModalView.WalletList);
          break;
        default:
          setCurrentView(ModalView.WalletList);
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrState, walletStatus, qrMsg, message]);

  useEffect(() => {
    if (!isOpen) return;
    if (walletStatus === "Connected") {
      setCurrentView(ModalView.Connected);
    } else {
      setCurrentView(ModalView.WalletList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onCloseModal = useCallback(() => {
    setOpen(false);
    if (walletStatus === "Connecting") {
      current?.disconnect(false, disconnectOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen, walletStatus, current]);

  const onReturn = useCallback(() => {
    setCurrentView(ModalView.WalletList);
  }, []);

  const wallets = useMemo(
    () => (!includeAllWalletsOnMobile ? walletRepo?.platformEnabledWallets : walletRepo?.wallets),
    [walletRepo, includeAllWalletsOnMobile]
  );

  const modalView = useMemo(() => {
    if (currentView === ModalView.WalletList) {
      return MODAL_VIEWS.WalletList({
        onClose: onCloseModal,
        wallets: wallets || []
      });
    }

    const getImplementation = MODAL_VIEWS[currentView] as ((props: WalletViewProps) => { head: React.ReactNode; content: React.ReactNode }) | undefined;
    if (!current || !getImplementation) {
      return { head: null, content: null };
    }
    return getImplementation({
      onClose: onCloseModal,
      onReturn,
      wallet: current,
      options: modalOptions
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, onReturn, onCloseModal, current, qrState, walletStatus, walletRepo, wallets, message, qrMsg]);

  return (
    <ThemeProvider defaultTheme={defaultTheme} overrides={overrides} themeDefs={themeDefs} customTheme={customTheme}>
      <ConnectModal
        isOpen={isOpen}
        header={modalView.head}
        onClose={onCloseModal}
        modalContainerClassName={modalContainerClassName}
        modalContentClassName={modalContentClassName}
        modalChildrenClassName={modalChildrenClassName}
        modalContentStyles={modalContentStyles}
      >
        {modalView.content}
      </ConnectModal>
    </ThemeProvider>
  );
}
