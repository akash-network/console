import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";

export const DEPENDENCIES = { useDeploymentNames };

const UNNAMED_DEPLOYMENT_LABEL = "this deployment";

export function useDeploymentName(dseq: string | null | undefined, knownName?: string | null, dependencies = DEPENDENCIES): string | null {
  const { getDeploymentName } = dependencies.useDeploymentNames(knownName || !dseq ? [] : [dseq]);

  return knownName || getDeploymentName(dseq);
}

export function deploymentLabelOf(name: string | null): string {
  return name || UNNAMED_DEPLOYMENT_LABEL;
}
