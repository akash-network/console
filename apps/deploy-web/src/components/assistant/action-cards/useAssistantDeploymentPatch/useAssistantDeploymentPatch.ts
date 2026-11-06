import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useMarkActivityOutcomes } from "@src/hooks/useHandledActivityOutcomes/useHandledActivityOutcomes";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import { isStaleProviderVersion } from "@src/utils/updateDeploymentFailure";

export const DEPENDENCIES = {
  useServices,
  useQueryClient,
  useMarkActivityOutcomes,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets
};

const HTTP_CONFLICT = 409;
const DEFINITION_CHANGED_ERROR_CODE = "deployment_definition_changed";
const RESOURCES_CHANGED_ERROR_CODE = "deployment_resources_changed";

export const DEFINITION_CHANGED_MESSAGE = "This deployment changed since this card was shown. Ask again so the assistant reads its current setup.";

type PatchDeploymentInput = Parameters<ReturnType<ReturnType<typeof useServices>["api"]["v1"]["patchDeployment"]["useMutation"]>["mutateAsync"]>[0];

export type AssistantServicesPatch = NonNullable<PatchDeploymentInput["data"]["services"]>;

export interface AssistantDeploymentPatch {
  dseq: string;
  services: AssistantServicesPatch;
  ifManifestVersion?: string;
  /** A seal of the values a secure input took; without one the patch seals an empty map, as the update tab does for plain variables. */
  sealedSecrets?: string;
}

export function isResourcesChanged(cause: unknown): boolean {
  return extractApiErrorCode(cause) === RESOURCES_CHANGED_ERROR_CODE;
}

function isDefinitionChanged(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && extractApiErrorCode(cause) === DEFINITION_CHANGED_ERROR_CODE;
}

/** Only the definition and stale-provider conflicts are named; every other 409 on this route answers a seal made against a retired key. */
function isStaleSeal(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && !isDefinitionChanged(cause) && !isStaleProviderVersion(cause);
}

/** Sends an assistant card's change through the same PATCH, seal and activity tracking as the deployment's update tab. */
export function useAssistantDeploymentPatch(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = d.useServices();
  const queryClient = d.useQueryClient();
  const { forgetEarlierOutcomes, markOutcomeHandled } = d.useMarkActivityOutcomes();
  const { mutateAsync: getSealContext } = api.v1.getSDLSecretsContext.useMutation();
  const { mutateAsync: patchDeployment } = api.v1.patchDeployment.useMutation();

  async function sealNothing(): Promise<string> {
    const { data: context } = await getSealContext();
    return await d.sealSdlSecrets({ context, secrets: {} });
  }

  async function send({ dseq, services, ifManifestVersion, sealedSecrets }: AssistantDeploymentPatch, canResealOnce: boolean): Promise<void> {
    const seal = sealedSecrets ?? (await sealNothing());
    forgetEarlierOutcomes("deployment_update", dseq);
    try {
      const response = await patchDeployment({ dseq, async: "true", data: { services, sealedSecrets: seal, ifManifestVersion } });
      if (!("activityId" in response.data)) markOutcomeHandled("deployment_update", dseq, "succeeded");
    } catch (cause) {
      if (canResealOnce && !sealedSecrets && isStaleSeal(cause)) return await send({ dseq, services, ifManifestVersion }, false);
      markOutcomeHandled("deployment_update", dseq, "failed");
      if (isDefinitionChanged(cause)) {
        void queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) });
        throw new Error(DEFINITION_CHANGED_MESSAGE, { cause });
      }
      throw cause;
    }

    void queryClient.invalidateQueries({ queryKey: api.v1.getDeployment.getKey({ dseq }) });
    await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
  }

  return (patch: AssistantDeploymentPatch) => send(patch, true);
}
