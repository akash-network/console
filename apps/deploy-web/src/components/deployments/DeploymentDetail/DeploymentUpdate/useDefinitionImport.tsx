import { useState } from "react";
import { extractApiErrorCode, extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import type { RecordableDefinition } from "@src/utils/sdl/recordableDefinition";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import { isStaleProviderVersion, STALE_PROVIDER_VERSION_FALLBACK_MESSAGE } from "@src/utils/updateDeploymentFailure";

export const DEPENDENCIES = {
  Snackbar,
  useSnackbar,
  useQueryClient,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets
};

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const DEFINITION_MISMATCH_ERROR_CODE = "deployment_definition_mismatch";
const DEFINITION_EXISTS_ERROR_CODE = "deployment_definition_exists";
const SAVE_FAILURE_MESSAGE = "Something went wrong while saving the configuration. Please try again.";
const UPDATE_FAILURE_MESSAGE = "Something went wrong while updating the deployment. Please try again.";

export interface DefinitionImportInput {
  dseq: string;
  onImported: () => void;
}

function hasErrorCode(cause: unknown, code: string): boolean {
  return isApiError(cause) && extractApiErrorCode(cause) === code;
}

/** Only the definition and stale-provider conflicts are named; every other 409 on these routes answers a seal made against a retired key. */
function isStaleSeal(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && !hasErrorCode(cause, DEFINITION_EXISTS_ERROR_CODE) && !isStaleProviderVersion(cause);
}

/** The review is where a document the api refused can be fixed, so its words go there rather than into a toast. */
function refusalOf(cause: unknown): string | null {
  if (!isApiError(cause) || (cause.status !== HTTP_BAD_REQUEST && cause.status !== HTTP_FORBIDDEN)) return null;
  return extractApiErrorMessage(cause) ?? null;
}

/** Every seal is bound to the sdl it travels with, since both routes take the document whole. */
export function useDefinitionImport({ dseq, onImported }: DefinitionImportInput, d = DEPENDENCIES) {
  const { api, analyticsService } = useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const getSdlSecretsContext = api.v1.getSDLSecretsContext.useMutation();
  const createDefinition = api.v1.createDeploymentDefinition.useMutation();
  const updateDeployment = api.v1.updateDeployment.useMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function sendSealed(definition: RecordableDefinition, send: (sealedSecrets: string) => Promise<unknown>, canResealOnce: boolean): Promise<void> {
    const context = await getSdlSecretsContext.mutateAsync();
    const sealedSecrets = await d.sealSdlSecrets({ context: context.data, sdl: definition.sdl, secrets: definition.secrets });

    try {
      await send(sealedSecrets);
    } catch (cause) {
      if (!canResealOnce || !isStaleSeal(cause)) throw cause;
      await sendSealed(definition, send, false);
    }
  }

  function takeUpTheRecordedDefinition() {
    queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) });
    onImported();
  }

  function startSaving() {
    setIsSaving(true);
    setRefusal(null);
  }

  /** Awaited rather than given per-call callbacks, which react-query drops once the tab unmounts mid-save. */
  async function record(definition: RecordableDefinition) {
    startSaving();
    setMismatch(false);

    try {
      await sendSealed(definition, sealedSecrets => createDefinition.mutateAsync({ dseq, data: { sdl: definition.sdl, sealedSecrets } }), true);
    } catch (cause) {
      setIsSaving(false);
      reportRecordFailure(cause);
      return;
    }

    setIsSaving(false);
    takeUpTheRecordedDefinition();
    enqueueSnackbar(<d.Snackbar title="Configuration saved" subTitle="This deployment's configuration is now saved to your account." iconVariant="success" />, {
      variant: "success"
    });
  }

  function reportRecordFailure(cause: unknown) {
    if (hasErrorCode(cause, DEFINITION_MISMATCH_ERROR_CODE)) {
      setMismatch(true);
      return;
    }

    if (hasErrorCode(cause, DEFINITION_EXISTS_ERROR_CODE)) {
      takeUpTheRecordedDefinition();
      enqueueSnackbar(<d.Snackbar title="Already saved" subTitle="This deployment's configuration was already saved to your account." iconVariant="info" />, {
        variant: "info"
      });
      return;
    }

    reportFailure(cause, { title: "Couldn't save the configuration", fallback: SAVE_FAILURE_MESSAGE });
  }

  async function applyAsUpdate(definition: RecordableDefinition) {
    startSaving();

    try {
      await sendSealed(definition, sealedSecrets => updateDeployment.mutateAsync({ dseq, data: { sdl: definition.sdl, sealedSecrets } }), true);
    } catch (cause) {
      setIsSaving(false);
      reportUpdateFailure(cause);
      return;
    }

    setIsSaving(false);
    setMismatch(false);
    analyticsService.track("update_deployment", { category: "deployments", label: "Update deployment" });
    takeUpTheRecordedDefinition();
    enqueueSnackbar(<d.Snackbar title="Deployment updated" subTitle="The new configuration is being applied to your deployment." iconVariant="success" />, {
      variant: "success"
    });
  }

  /** The api already recorded the definition and sent the deployment update, so the tab takes it up even though the provider has yet to run it. */
  function reportUpdateFailure(cause: unknown) {
    if (isStaleProviderVersion(cause)) {
      setMismatch(false);
      takeUpTheRecordedDefinition();
      enqueueSnackbar(
        <d.Snackbar
          title={`Update to deployment ${dseq} not applied yet`}
          subTitle={extractApiErrorMessage(cause) ?? STALE_PROVIDER_VERSION_FALLBACK_MESSAGE}
          iconVariant="warning"
        />,
        { variant: "warning", autoHideDuration: null }
      );
      return;
    }

    reportFailure(cause, { title: "Couldn't update the deployment", fallback: UPDATE_FAILURE_MESSAGE });
  }

  function reportFailure(cause: unknown, copy: { title: string; fallback: string }) {
    const documentRefusal = refusalOf(cause);
    if (documentRefusal !== null) {
      setRefusal(documentRefusal);
      return;
    }

    enqueueSnackbar(<d.Snackbar title={copy.title} subTitle={extractApiErrorMessage(cause) ?? copy.fallback} iconVariant="error" />, {
      variant: "error",
      autoHideDuration: null
    });
  }

  return { record, applyAsUpdate, isSaving, mismatch, refusal };
}
