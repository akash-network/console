import { atom } from "jotai";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

const balance = atom<WalletBalance | null>(null);

const walletStore = {
  balance
};

export default walletStore;
