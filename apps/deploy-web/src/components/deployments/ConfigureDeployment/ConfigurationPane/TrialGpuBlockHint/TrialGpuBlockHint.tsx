import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useSearchParams } from "next/navigation";

import { BlockedGpuAlternatives } from "@src/components/deployments/BlockedGpuAlternatives/BlockedGpuAlternatives";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { SdlBuilderFormValuesType } from "@src/types";
import { hasTrialBlockedGpu } from "@src/utils/deploymentData/v1beta3";

export const DEPENDENCIES = { BlockedGpuAlternatives, useServices, useFlag, useSearchParams };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

/** Rendered only for a restricted (trial) account, so it answers just whether this deployment asks for a GPU the trial blocks. */
export const TrialGpuBlockHint: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  const { publicConfig } = d.useServices();
  const isIntentFirst = d.useFlag("onboarding_intent_first");
  const searchParams = d.useSearchParams();

  if (!isIntentFirst || !hasTrialBlockedGpu({ services }, publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS)) return null;

  return <d.BlockedGpuAlternatives templateId={searchParams?.get("templateId") ?? undefined} placement="configure" />;
};
