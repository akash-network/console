import { useCallback } from "react";
import { useFormContext } from "react-hook-form";

import { useFlag } from "@src/hooks/useFlag";
import type { SdlBuilderFormValuesType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  // eslint-disable-next-line akash/dependencies-component-or-hook
  generateSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  resolveSdlSecrets,
  useFlag
};

/** Re-fires the lease request from the current form values; with secrets on, the typed values ride along so a patch can seal them. */
export function useRetryDeploy({ flow }: { flow: DeploymentFlow }, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { getValues } = useFormContext<SdlBuilderFormValuesType>();
  const isSecretsEnabled = d.useFlag("ui_deployment_secrets");

  return useCallback(() => {
    const values = getValues();
    const sdl = d.generateSdl(values, { sealSecrets: isSecretsEnabled });
    if (isSecretsEnabled) {
      const secrets = d.resolveSdlSecrets(values, { sealSecrets: true });
      flow.actions.deploy(sdl, { secrets: secrets.values, unresolvedSecrets: secrets.unresolved });
      return;
    }
    flow.actions.deploy(sdl);
  }, [d, flow.actions, getValues, isSecretsEnabled]);
}
