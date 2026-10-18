import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert } from "@akashnetwork/ui/components";

import type { SdlBuilderFormValuesType } from "@src/types";
import {
  describeDeploymentSize,
  describeTrialResourceLimit,
  exceedsTrialResourceLimit,
  measureDeploymentSize
} from "../HardwareSection/trialResourceLimit/trialResourceLimit";
import { useTrialResourceLimit } from "../HardwareSection/useTrialResourceLimit/useTrialResourceLimit";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";

export const DEPENDENCIES = { Alert, UnlockGpusButton, useTrialResourceLimit };

/** Hover explanation for the trial unlock CTA; mirrors the phrasing of the high-end GPU unlock copy. */
const LARGER_DEPLOYMENTS_UNLOCK_EXPLANATION =
  "Larger deployments aren't included in your free trial. Add credits to unlock them, along with longer runtimes and the full Console.";

type Props = {
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** States the trial's size cap before a provider is chosen, since the api refuses a bigger trial deployment only once it is created. */
export const TrialResourceLimitHint: FC<Props> = ({ onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  const limit = d.useTrialResourceLimit();

  if (!limit) return null;

  const limitSentence = `Free trial deployments are limited to ${describeTrialResourceLimit(limit)}.`;
  const size = measureDeploymentSize(services);

  if (!exceedsTrialResourceLimit(size, limit)) {
    return <p className="text-xs text-muted-foreground">{limitSentence}</p>;
  }

  return (
    <d.Alert variant="warning" className="p-4">
      <div className="flex flex-col items-start gap-2 text-sm">
        <p>{`This deployment requests ${describeDeploymentSize(size)}. ${limitSentence}`}</p>
        <d.UnlockGpusButton onUnlock={onUnlock} prominent label="Unlock larger deployments" explanation={LARGER_DEPLOYMENTS_UNLOCK_EXPLANATION} />
      </div>
    </d.Alert>
  );
};
