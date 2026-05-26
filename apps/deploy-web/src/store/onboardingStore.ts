import { atomWithStorage } from "jotai/utils";

export type OnboardingFlow = "legacy" | "redesign";

const selectedOnboardingFlow = atomWithStorage<OnboardingFlow | null>("selectedOnboardingFlow", null);

const onboardingStore = {
  selectedOnboardingFlow
};

export default onboardingStore;
