import { useCallback } from "react";
import { useFormContext } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  // eslint-disable-next-line akash/dependencies-component-or-hook
  generateSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  resolveSdlSecrets
};

/** Re-fires the lease request from the current form values, with the typed secret values riding along so a patch can seal them. */
export function useRetryDeploy({ flow }: { flow: DeploymentFlow }, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { getValues } = useFormContext<SdlBuilderFormValuesType>();

  return useCallback(() => {
    const values = getValues();
    const secrets = d.resolveSdlSecrets(values, { sealSecrets: true });
    flow.actions.deploy(d.generateSdl(values, { sealSecrets: true }), { secrets: secrets.values, unresolvedSecrets: secrets.unresolved });
  }, [d, flow.actions, getValues]);
}
