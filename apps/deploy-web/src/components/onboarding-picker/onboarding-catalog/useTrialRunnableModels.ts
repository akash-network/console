import { pickRunnableModels, trialLimitsFrom } from "@src/components/onboarding-picker/onboarding-catalog/onboarding-catalog";
import { useServices } from "@src/context/ServicesProvider";
import { useTrialGpuAvailability } from "@src/queries/useGpuQuery";

/** A failed or pending availability check answers no models, so nothing is offered that might end with no bids. */
export function useTrialRunnableModels() {
  const { publicConfig } = useServices();
  const availability = useTrialGpuAvailability();

  return {
    models: pickRunnableModels(availability.data ?? [], trialLimitsFrom(publicConfig)),
    isChecking: availability.isLoading
  };
}
