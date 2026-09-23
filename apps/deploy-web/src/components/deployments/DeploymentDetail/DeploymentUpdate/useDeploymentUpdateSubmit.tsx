import { useState } from "react";
import { extractApiErrorCode, extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { AddCreditsSnackbarContent } from "@src/components/billing-usage/AddCreditsSnackbarContent/AddCreditsSnackbarContent";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ServicesPatch } from "@src/utils/sdl/sdlServicesPatch";
import { isEmptyServicesPatch } from "@src/utils/sdl/sdlServicesPatch";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import {
  addCreditsContentOf,
  creditsRefusalOf,
  isClientRefusal,
  isStaleProviderVersion,
  sdlRefusalOf,
  STALE_PROVIDER_VERSION_FALLBACK_MESSAGE,
  UPDATE_FAILURE_MESSAGE
} from "@src/utils/updateDeploymentFailure";
import { servicesPatchOf } from "./deploymentUpdatePatch";

export const DEPENDENCIES = {
  Snackbar,
  AddCreditsSnackbarContent,
  useWallet,
  useBalances,
  useSnackbar,
  useQueryClient,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets
};

const HTTP_CONFLICT = 409;
const DEFINITION_CHANGED_ERROR_CODE = "deployment_definition_changed";
const NOTHING_TO_UPDATE_MESSAGE = "Nothing has changed since this deployment was loaded.";
const DEFINITION_CHANGED_MESSAGE = "This deployment was updated elsewhere, so the form now shows its current configuration. Make your changes again.";
const DEFINITION_RELOAD_FAILED_MESSAGE =
  "This deployment was updated elsewhere, and its current configuration could not be loaded. Reload the page before making changes.";

export interface LandedDeploymentUpdate {
  values: SdlBuilderFormValuesType;
  manifestVersion: string | undefined;
}

export interface DeploymentUpdateSubmitInput {
  dseq: string;
  /** The version the form was seeded from, so an update made elsewhere since then is refused rather than overwritten. */
  manifestVersion: string | undefined;
  onUpdated: (update: LandedDeploymentUpdate) => void;
  onDefinitionChanged: () => void;
  onDefinitionReloadFailed: () => void;
}

function isDefinitionChanged(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && extractApiErrorCode(cause) === DEFINITION_CHANGED_ERROR_CODE;
}

/** Only the definition and stale-provider conflicts are named; every other 409 on this route answers a seal made against a retired key. */
function isStaleSeal(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && !isDefinitionChanged(cause) && !isStaleProviderVersion(cause);
}

/** Always sends a seal, empty or not, because the api seals every variable a patch without one writes. */
export function useDeploymentUpdateSubmit(
  { dseq, manifestVersion, onUpdated, onDefinitionChanged, onDefinitionReloadFailed }: DeploymentUpdateSubmitInput,
  d = DEPENDENCIES
) {
  const { api, analyticsService } = useServices();
  const { address } = d.useWallet();
  const { refetch: refetchBalances } = d.useBalances(address);
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const getSdlSecretsContext = api.v1.getSDLSecretsContext.useMutation();
  const patchDeployment = api.v1.patchDeployment.useMutation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [sdlRefusal, setSdlRefusal] = useState<string | null>(null);

  function refetchDefinition() {
    queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) });
  }

  async function sealNothing(): Promise<string> {
    const context = await getSdlSecretsContext.mutateAsync();
    return await d.sealSdlSecrets({ context: context.data, secrets: {} });
  }

  /** Awaited rather than given per-call callbacks, which react-query drops once the tab unmounts mid-update. */
  async function sealAndPatch(services: ServicesPatch, current: SdlBuilderFormValuesType, canResealOnce: boolean) {
    let response: Awaited<ReturnType<typeof patchDeployment.mutateAsync>>;
    try {
      const sealedSecrets = await sealNothing();
      response = await patchDeployment.mutateAsync({ dseq, data: { services, sealedSecrets, ifManifestVersion: manifestVersion } });
    } catch (cause) {
      if (canResealOnce && isStaleSeal(cause)) {
        await sealAndPatch(services, current, false);
        return;
      }
      reportFailure(cause);
      return;
    }

    completeUpdate(current, response.data.manifestVersion);
  }

  function completeUpdate(values: SdlBuilderFormValuesType, manifestVersion: string | undefined) {
    setIsUpdating(false);
    refetchDefinition();
    analyticsService.track("update_deployment", { category: "deployments", label: "Update deployment" });
    analyticsService.track("successful_tx", { category: "transactions", label: "Successful transaction" });
    refetchBalances();
    enqueueSnackbar(<d.Snackbar title="Deployment updated" subTitle="The new configuration is being applied to your deployment." iconVariant="success" />, {
      variant: "success"
    });
    onUpdated({ values, manifestVersion });
  }

  async function reloadTheChangedDefinition() {
    const isReloaded = await queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) }, { throwOnError: true }).then(
      () => true,
      () => false
    );
    if (!isReloaded) onDefinitionReloadFailed();
    enqueueSnackbar(
      <d.Snackbar title="Changed elsewhere" subTitle={isReloaded ? DEFINITION_CHANGED_MESSAGE : DEFINITION_RELOAD_FAILED_MESSAGE} iconVariant="warning" />,
      { variant: "warning" }
    );
  }

  function reportFailure(cause: unknown) {
    setIsUpdating(false);

    if (isDefinitionChanged(cause)) {
      void reloadTheChangedDefinition();
      onDefinitionChanged();
      return;
    }

    refetchBalances();
    if (isStaleProviderVersion(cause)) {
      reportUpdateTheProviderHasYetToApply(cause);
      return;
    }

    if (!isClientRefusal(cause)) {
      analyticsService.track("failed_tx", { category: "transactions", label: "Failed transaction" });
    }

    const refusal = sdlRefusalOf(cause);
    if (refusal !== null) {
      setSdlRefusal(refusal);
      return;
    }

    const creditsRefusal = creditsRefusalOf(cause);
    if (creditsRefusal !== null) {
      offerCredits(creditsRefusal);
      return;
    }

    enqueueSnackbar(<d.Snackbar title="Error" subTitle={extractApiErrorMessage(cause) ?? UPDATE_FAILURE_MESSAGE} iconVariant="error" />, {
      variant: "error",
      autoHideDuration: null
    });
  }

  /** The chain already took this update, so the form keeps its edits for a resubmit that pushes the same patch to the provider again. */
  function reportUpdateTheProviderHasYetToApply(cause: unknown) {
    refetchDefinition();
    enqueueSnackbar(
      <d.Snackbar
        title={`Update to deployment ${dseq} not applied yet`}
        subTitle={extractApiErrorMessage(cause) ?? STALE_PROVIDER_VERSION_FALLBACK_MESSAGE}
        iconVariant="warning"
      />,
      { variant: "warning", autoHideDuration: null }
    );
  }

  function offerCredits(refusal: string) {
    const { title, message } = addCreditsContentOf(refusal);
    const key = enqueueSnackbar(
      <d.Snackbar title={title} subTitle={<d.AddCreditsSnackbarContent message={message} onAction={() => closeSnackbar(key)} />} iconVariant="warning" />,
      { variant: "warning", autoHideDuration: 10000 }
    );
  }

  function submit(seed: SdlBuilderFormValuesType, current: SdlBuilderFormValuesType) {
    const services = servicesPatchOf(seed, current);
    if (isEmptyServicesPatch(services)) {
      enqueueSnackbar(<d.Snackbar title="Nothing to update" subTitle={NOTHING_TO_UPDATE_MESSAGE} iconVariant="info" />, { variant: "info" });
      return;
    }

    setSdlRefusal(null);
    setIsUpdating(true);
    void sealAndPatch(services, current, true);
  }

  return { submit, isUpdating, sdlRefusal };
}
