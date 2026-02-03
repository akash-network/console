import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { IS_SIGNED_IN_WITH_TRIAL_KEY } from "@src/services/storage/keys";

const isSignedInWithTrial = atomWithStorage<boolean>(IS_SIGNED_IN_WITH_TRIAL_KEY, false);
const selectedWalletType = atomWithStorage<"managed" | "custodial">("selectedWalletType", "custodial");
const isWalletModalOpen = atom<boolean>(false);
const balance = atom<WalletBalance | null>(null);

const walletStore = {
  isSignedInWithTrial,
  selectedWalletType,
  isWalletModalOpen,
  balance
};

export default walletStore;
