import { useCallback } from "react";
import { useAtomValue } from "jotai";
import dynamic from "next/dynamic";

import { useChainStore } from "../../context/ChainStoreProvider";

const WalletModal = dynamic(() => import("../WalletModal/WalletModal").then(mod => mod.WalletModal), { ssr: false });

export function ModalWrapper() {
  const chainStore = useChainStore();
  const isOpen = useAtomValue(chainStore.modalIsOpenAtom);
  const walletRepo = useAtomValue(chainStore.modalWalletRepoAtom);

  const toggleOpen = useCallback(
    (open: boolean) => {
      chainStore.toggleModalOpen(open);
    },
    [chainStore]
  );

  return <WalletModal isOpen={isOpen} setOpen={toggleOpen} walletRepo={walletRepo} />;
}
