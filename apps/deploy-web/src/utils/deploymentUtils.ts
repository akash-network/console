import type { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import type { ExposeType, TemplateCreation } from "@src/types";

export interface SendManifestToProviderOptions {
  dseq: string;
  localCert?: LocalCert | null;
  chainNetwork: string;
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
