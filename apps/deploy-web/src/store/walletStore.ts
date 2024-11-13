import { atomWithStorage } from "jotai/utils";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);
const isWalletModalOpen = atomWithStorage<boolean>("isWalletModalOpen", false);

export default {
  isSignedInWithTrial,
  isWalletModalOpen
};
