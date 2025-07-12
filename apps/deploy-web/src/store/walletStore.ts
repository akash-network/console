import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);
const selectedWalletType = atomWithStorage<"managed" | "custodial">("selectedWalletType", "custodial");
const isWalletModalOpen = atom<boolean>(false);

const walletStore = {
  isSignedInWithTrial,
  selectedWalletType,
  isWalletModalOpen
};

export default walletStore;
