import { atom } from "jotai";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

const isWalletModalOpen = atom<boolean>(false);
const balance = atom<WalletBalance | null>(null);

const walletStore = {
  isWalletModalOpen,
  balance
};

export default walletStore;
