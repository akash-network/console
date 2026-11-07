import type { ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import type { SnackbarKey } from "notistack";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { useCachedNotBiddingProviderCount, useCachedScreenedProviderCount } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets, unresolvedSecretMessage } from "@src/utils/sdl/sdlSecrets";
import { validateGeneratedSdl } from "@src/utils/sdl/validateGeneratedSdl";
import type { TrialResourceLimit } from "../ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import {
  describeDeploymentSize,
  describeTrialResourceLimit,
  exceedsTrialResourceLimit,
  fitServicesToTrialResourceLimit,
  measureDeploymentSize
} from "../ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import { useTrialGate } from "../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";
import { useTrialResourceLimit } from "../ConfigurationPane/HardwareSection/useTrialResourceLimit/useTrialResourceLimit";
import { useInheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { listInvalidFieldMessages, listInvalidFieldPaths } from "./invalidFieldMessages";
import { describeTrialGpuBlocks, dropTrialBlockedGpuModels } from "./trialGpuFit";

export const DEPENDENCIES = {
  useSnackbar,
  useAddCredits,
  Snackbar,
  Button,
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

/** Offers a way past the block; `dismiss` closes the snackbar that offers it. */
type RenderBlockActions = (dismiss: () => void) => ReactNode;

type SubmitBlock = { reason: SubmitBlockReason; message: string; renderActions?: RenderBlockActions };

const FITTED_FIELD_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

const LARGER_DEPLOYMENTS_DESCRIPTION = "Add credits to deploy larger workloads, along with longer runtimes and the full Console.";

/** Regenerates the SDL from the values the form just accepted, never a prop snapshot, so validation and creation act on the same spec. */
export function useRequestQuotes({ flow, deploymentName, onInvalid }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { handleSubmit, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const openAddCredits = d.useAddCredits();
  const { analyticsService } = d.useServices();
  const { isRestricted } = d.useTrialGate();
  const trialResourceLimit = d.useTrialResourceLimit();
  const inheritedSecrets = d.useInheritedSecrets();
  const countScreenedProviders = d.useCachedScreenedProviderCount();
  const countNotBiddingProviders = d.useCachedNotBiddingProviderCount();

  function explainWhySubmitIsBlocked(reasons: string[], renderActions?: RenderBlockActions) {
    const snackbar: { key?: SnackbarKey } = {};
    const dismiss = () => closeSnackbar(snackbar.key);
    snackbar.key = enqueueSnackbar(
      <d.Snackbar
        title="Your deployment can't be submitted yet"
        subTitle={
          <>
            <ul className="list-disc pl-4">
              {reasons.map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {renderActions && <div className="mt-3 flex flex-wrap gap-2">{renderActions(dismiss)}</div>}
          </>
        }
        iconVariant="error"
      />,
      renderActions ? { variant: "error", persist: true } : { variant: "error" }
    );
  }

  function refuseSubmit(
    reasons: SubmitBlockReason[],
    messages: string[],
    { renderActions, ...details }: { invalidFields?: string[]; renderActions?: RenderBlockActions } = {}
  ) {
    analyticsService.track("configure_choose_provider_blocked", { category: "deployments", reasons: [...new Set(reasons)], ...details });
    explainWhySubmitIsBlocked(messages, renderActions);
  }

  /** Undefined unless both the size and the GPU rules of the trial can be met without the user picking anything. */
  function fitServicesToTrial(services: ServiceType[], limit: TrialResourceLimit) {
    const servicesOnTrialGpus = isRestricted ? dropTrialBlockedGpuModels(services) : services;
    return servicesOnTrialGpus && fitServicesToTrialResourceLimit(servicesOnTrialGpus, limit);
  }

  /** Fits the services as they are at the click, since the user can edit them while the block stays on screen. */
  function fitCurrentServicesToTrial(limit: TrialResourceLimit) {
    const currentServices = getValues().services;
    const fittedServices = fitServicesToTrial(currentServices, limit);
    if (!fittedServices) return;
    const hasDroppedGpuModels = (service: ServiceType, index: number) => service.profile.gpuModels !== currentServices[index].profile.gpuModels;
    fittedServices.forEach((service, index) => {
      setValue(`services.${index}.profile.cpu`, service.profile.cpu, FITTED_FIELD_OPTIONS);
      setValue(`services.${index}.profile.ram`, service.profile.ram, FITTED_FIELD_OPTIONS);
      setValue(`services.${index}.profile.ramUnit`, service.profile.ramUnit, FITTED_FIELD_OPTIONS);
      if (hasDroppedGpuModels(service, index)) {
        setValue(`services.${index}.profile.gpuModels`, service.profile.gpuModels, FITTED_FIELD_OPTIONS);
      }
    });
    analyticsService.track("configure_trial_size_fitted", { category: "deployments" });
    const gpuNote = fittedServices.some(hasDroppedGpuModels) ? " It now uses only GPU models your trial allows." : "";
    enqueueSnackbar(
      <d.Snackbar
        title="Resized to fit your free trial"
        subTitle={`This deployment now requests ${describeDeploymentSize(measureDeploymentSize(fittedServices))}.${gpuNote}`}
        iconVariant="success"
      />,
      { variant: "success" }
    );
  }

  function openAddCreditsForLargerDeployments() {
    openAddCredits({ initialTab: "purchase", description: LARGER_DEPLOYMENTS_DESCRIPTION, context: "trial_size_limit", suggestFirstDeployment: false });
  }

  function offerWaysPastTrialSizeLimit(services: ServiceType[], limit: TrialResourceLimit): RenderBlockActions {
    const canFit = !!fitServicesToTrial(services, limit);
    return dismiss => (
      <>
        {canFit && (
          <d.Button
            type="button"
            size="sm"
            onClick={() => {
              fitCurrentServicesToTrial(limit);
              dismiss();
            }}
          >
            Fit to free trial
          </d.Button>
        )}
        <d.Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            openAddCreditsForLargerDeployments();
            dismiss();
          }}
        >
          Add credits
        </d.Button>
      </>
    );
  }

  function findTrialBlocks(values: SdlBuilderFormValuesType): SubmitBlock[] {
    const blocks: SubmitBlock[] = isRestricted ? describeTrialGpuBlocks(values.services).map(message => ({ reason: "trial_gpu" as const, message })) : [];
    const size = measureDeploymentSize(values.services);
    if (trialResourceLimit && exceedsTrialResourceLimit(size, trialResourceLimit)) {
      blocks.push({
        reason: "trial_size_limit",
        message: `This deployment requests ${describeDeploymentSize(size)}. Free trial deployments are limited to ${describeTrialResourceLimit(trialResourceLimit)}.`,
        renderActions: offerWaysPastTrialSizeLimit(values.services, trialResourceLimit)
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
          blocks.map(block => block.message),
          { renderActions: blocks.find(block => block.renderActions)?.renderActions }
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
