import type { FieldErrors } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useFlag } from "@src/hooks/useFlag";
import { useCachedScreenedProviderCount } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { hasTrialBlockedGpu } from "@src/utils/deploymentData/v1beta3";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets, unresolvedSecretMessage } from "@src/utils/sdl/sdlSecrets";
import { validateGeneratedSdl } from "@src/utils/sdl/validateGeneratedSdl";
import { useTrialGate } from "../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";
import { useInheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { listInvalidFieldMessages } from "./invalidFieldMessages";

export const DEPENDENCIES = {
  useSnackbar,
  Snackbar,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  generateSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  validateGeneratedSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  resolveSdlSecrets,
  useFlag,
  useInheritedSecrets,
  useTrialGate,
  useCachedScreenedProviderCount
};

type Input = {
  flow: DeploymentFlow;
  deploymentName: string;
  onInvalid?: (errors: FieldErrors<SdlBuilderFormValuesType>) => void;
};

/** Regenerates the SDL from the values the form just accepted, never a prop snapshot, so validation and creation act on the same spec. */
export function useRequestQuotes({ flow, deploymentName, onInvalid }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { handleSubmit, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar } = d.useSnackbar();
  const { isRestricted } = d.useTrialGate();
  const isSecretsEnabled = d.useFlag("ui_deployment_secrets");
  const inheritedSecrets = d.useInheritedSecrets();
  const countScreenedProviders = d.useCachedScreenedProviderCount();

  function explainWhySubmitIsBlocked(reasons: string[]) {
    enqueueSnackbar(
      <d.Snackbar
        title="Your deployment can't be submitted yet"
        subTitle={
          <ul className="list-disc pl-4">
            {reasons.map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        }
        iconVariant="error"
      />,
      { variant: "error" }
    );
  }

  return handleSubmit(
    values => {
      const sdl = d.generateSdl(values, { sealSecrets: isSecretsEnabled });
      const errors = [...d.validateGeneratedSdl(sdl)];
      const secrets = isSecretsEnabled ? d.resolveSdlSecrets(values, { sealSecrets: true, heldNames: inheritedSecrets?.names }) : undefined;
      secrets?.unresolved.forEach(secret => errors.push(unresolvedSecretMessage(secret)));
      if (isRestricted && hasTrialBlockedGpu(values)) {
        errors.push("GPU access is not available on a free trial. Add funds to unlock GPU access.");
      }
      if (errors.length > 0) {
        explainWhySubmitIsBlocked(errors);
        return;
      }
      flow.actions.requestQuotes(sdl, {
        name: deploymentName,
        screening: { placementCount: values.placements.length, providerCount: countScreenedProviders(sdl, values.placements) },
        ...(secrets ? { secrets: secrets.values, ...(inheritedSecrets ? { inheritSecretsFrom: inheritedSecrets.sourceDseq } : {}) } : {})
      });
    },
    errors => {
      explainWhySubmitIsBlocked(listInvalidFieldMessages(getValues(), errors));
      onInvalid?.(errors);
    }
  );
}
