import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

export type SelectedWalletType = "managed" | "custodial";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);
const selectedWalletType = atomWithStorage<SelectedWalletType>("selectedWalletType", "custodial");
const isWalletModalOpen = atom<boolean>(false);
const balance = atom<WalletBalance | null>(null);

const walletStore = {
  isSignedInWithTrial,
  selectedWalletType,
  isWalletModalOpen,
  balance
};

export default walletStore;
