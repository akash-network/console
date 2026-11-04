import type { OnboardingSlot, TrialLimits } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { ONBOARDING_SLOTS, pickOnboardingCards } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { useServices } from "@src/context/ServicesProvider";

export type GetStartedQuickPick = { templateId: string; label: string };

export function useGetStartedQuickPicks(slots: readonly OnboardingSlot[] = ONBOARDING_SLOTS): GetStartedQuickPick[] {
  const { publicConfig } = useServices();
  const limits: TrialLimits = {
    maxCpu: publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU,
    maxMemoryGi: publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI,
    blockedGpuModels: publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
  };

  return pickOnboardingCards(slots, limits).map(({ template }) => ({
    templateId: template.templateId,
    label: template.gpu ? `${template.name} · GPU` : template.name
  }));
}
