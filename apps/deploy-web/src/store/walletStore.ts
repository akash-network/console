import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);
const isWalletModalOpen = atom<boolean>(false);
const balance = atom<WalletBalance | null>(null);

const walletStore = {
  isSignedInWithTrial,
  isWalletModalOpen,
  balance
};

export default walletStore;
