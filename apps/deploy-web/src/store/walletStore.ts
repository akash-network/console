import { atomWithStorage } from "jotai/utils";

const isSignedInWithTrial = atomWithStorage<boolean>("isSignedInWithTrial", false);

export default {
  isSignedInWithTrial
};
