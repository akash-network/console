import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);
const isWalletModalOpen = atom<boolean>(false);

export default {
  isSignedInWithTrial,
  isWalletModalOpen
};
