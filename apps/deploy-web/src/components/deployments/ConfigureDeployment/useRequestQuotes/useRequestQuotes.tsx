import type { FieldErrors } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCachedNotBiddingProviderCount, useCachedScreenedProviderCount } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { hasTrialBlockedGpu } from "@src/utils/deploymentData/v1beta3";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets, unresolvedSecretMessage } from "@src/utils/sdl/sdlSecrets";
import { validateGeneratedSdl } from "@src/utils/sdl/validateGeneratedSdl";
import {
  describeTrialResourceLimit,
  exceedsTrialResourceLimit,
  measureDeploymentSize
} from "../ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import { useTrialGate } from "../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";
import { useTrialResourceLimit } from "../ConfigurationPane/HardwareSection/useTrialResourceLimit/useTrialResourceLimit";
import { useInheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { listInvalidFieldMessages, listInvalidFieldPaths } from "./invalidFieldMessages";

export const DEPENDENCIES = {
  useSnackbar,
  Snackbar,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  generateSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  validateGeneratedSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  resolveSdlSecrets,
  useInheritedSecrets,
  useTrialGate,
  useTrialResourceLimit,
  useCachedScreenedProviderCount,
  useCachedNotBiddingProviderCount,
  useServices
};

type Input = {
  flow: DeploymentFlow;
  deploymentName: string;
  onInvalid?: (errors: FieldErrors<SdlBuilderFormValuesType>) => void;
};

/** Named for analytics, so a refused click can be told apart from one that never reached a deployment. */
type SubmitBlockReason = "invalid_field" | "sdl_invalid" | "unresolved_secret" | "trial_gpu" | "trial_size_limit";

type SubmitBlock = { reason: SubmitBlockReason; message: string };

/** Regenerates the SDL from the values the form just accepted, never a prop snapshot, so validation and creation act on the same spec. */
export function useRequestQuotes({ flow, deploymentName, onInvalid }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { handleSubmit, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();
  const { isRestricted } = d.useTrialGate();
  const trialResourceLimit = d.useTrialResourceLimit();
  const inheritedSecrets = d.useInheritedSecrets();
  const countScreenedProviders = d.useCachedScreenedProviderCount();
  const countNotBiddingProviders = d.useCachedNotBiddingProviderCount();

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

  function refuseSubmit(reasons: SubmitBlockReason[], messages: string[], details: { invalidFields?: string[] } = {}) {
    analyticsService.track("configure_choose_provider_blocked", { category: "deployments", reasons: [...new Set(reasons)], ...details });
    explainWhySubmitIsBlocked(messages);
  }

  function findTrialBlocks(values: SdlBuilderFormValuesType): SubmitBlock[] {
    const blocks: SubmitBlock[] = [];
    if (isRestricted && hasTrialBlockedGpu(values)) {
      blocks.push({ reason: "trial_gpu", message: "GPU access is not available on a free trial. Add funds to unlock GPU access." });
    }
    if (trialResourceLimit && exceedsTrialResourceLimit(measureDeploymentSize(values.services), trialResourceLimit)) {
      blocks.push({
        reason: "trial_size_limit",
        message: `Free trial deployments are limited to ${describeTrialResourceLimit(trialResourceLimit)}. Add funds to deploy larger workloads.`
      });
    }
    return blocks;
  }

  return handleSubmit(
    values => {
      const sdl = d.generateSdl(values, { sealSecrets: true });
      const secrets = d.resolveSdlSecrets(values, { sealSecrets: true, heldNames: inheritedSecrets?.names });
      const blocks: SubmitBlock[] = [
        ...d.validateGeneratedSdl(sdl).map(message => ({ reason: "sdl_invalid" as const, message })),
        ...secrets.unresolved.map(secret => ({ reason: "unresolved_secret" as const, message: unresolvedSecretMessage(secret) })),
        ...findTrialBlocks(values)
      ];
      if (blocks.length > 0) {
        refuseSubmit(
          blocks.map(block => block.reason),
          blocks.map(block => block.message)
        );
        return;
      }
      flow.actions.requestQuotes(sdl, {
        name: deploymentName,
        screening: {
          placementCount: values.placements.length,
          providerCount: countScreenedProviders(sdl, values.placements),
          notBiddingProviderCount: countNotBiddingProviders(sdl, values.placements)
        },
        secrets: secrets.values,
        ...(inheritedSecrets ? { inheritSecretsFrom: inheritedSecrets.sourceDseq } : {})
      });
    },
    errors => {
      refuseSubmit(["invalid_field"], listInvalidFieldMessages(getValues(), errors), { invalidFields: listInvalidFieldPaths(errors) });
      onInvalid?.(errors);
    }
  );
}
