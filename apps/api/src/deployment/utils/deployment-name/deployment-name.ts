import type { Manifest } from "@akashnetwork/chain-sdk";

/** Bounds the name in the request schema alone, the column being unsized, so a name the console derives for a caller who supplied none is shortened rather than refusing a create that would succeed today. */
export const MAX_DEPLOYMENT_NAME_LENGTH = 256;

const SERVICE_NAME_SEPARATOR = "+";

export function deriveDeploymentName(groups: Manifest): string | undefined {
  const serviceNames = new Set(
    Iterator.from(groups)
      .flatMap(group => group.services)
      .map(service => service.name.trim())
      .filter(serviceName => serviceName.length > 0)
  );

  if (serviceNames.size === 0) {
    return undefined;
  }

  return [...serviceNames].join(SERVICE_NAME_SEPARATOR).slice(0, MAX_DEPLOYMENT_NAME_LENGTH);
}
