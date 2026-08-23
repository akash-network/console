import type { ExposeType, TemplateCreation } from "@src/types";
import type { DeploymentDto } from "@src/types/deployment";

/**
 * Blocks per hour as the API counts them, mirroring `averageBlockCountInAnHour` in apps/api (a flat 6s
 * block time). Deliberately not `priceUtils`' 6.098s measured average: this number only feeds runtime-limit
 * quotes, and matching the API means the hours we quote are the hours it actually funds. The chain runs
 * closer to 590 blocks an hour, so a quote based on 600 is a slight over-estimate, which is the safe side.
 */
export const API_BLOCKS_PER_HOUR = 600;

/** Denom of the deployment's escrow account, taken from its first fund entry; empty string when the account has no funds. */
export function getEscrowDenom(deployment: DeploymentDto): string {
  return deployment.escrowAccount.state.funds[0]?.denom || "";
}

/**
 * Validate values to change in the template
 */
export function validateDeploymentData(deploymentData: Record<string, any>, selectedTemplate?: TemplateCreation | null) {
  if (selectedTemplate?.valuesToChange) {
    for (const valueToChange of selectedTemplate.valuesToChange) {
      if (valueToChange.field === "accept" || valueToChange.field === "env") {
        const serviceNames = Object.keys(deploymentData.sdl.services);
        for (const serviceName of serviceNames) {
          if (
            deploymentData.sdl.services[serviceName].expose?.some((e: ExposeType) => e.accept?.includes(valueToChange.initialValue)) ||
            deploymentData.sdl.services[serviceName].env?.some((e: string) => e?.includes(valueToChange.initialValue))
          ) {
            const error = new Error(`Template value of "${valueToChange.initialValue}" needs to be changed`);
            error.name = "TemplateValidation";

            throw error;
          }
        }
      }
    }
  }
}

export function getGpusFromAttributes(attributes: { key: string; value: string }[]) {
  return attributes
    .filter(attr => attr.key.startsWith("vendor/") && attr.value === "true")
    .map(attr => {
      const modelKey = attr.key.split("/");

      // vendor/nvidia/model/h100 -> nvidia,h100
      return { vendor: modelKey[1], model: modelKey[3] };
    });
}
