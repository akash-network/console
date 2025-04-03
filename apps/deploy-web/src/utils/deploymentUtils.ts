import type { AxiosResponse } from "axios";

import type { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { services } from "@src/services/http/http-browser.service";
import type { ExposeType, TemplateCreation } from "@src/types";
import type { ApiProviderList } from "@src/types/provider";
import { wait } from "./timer";

export interface SendManifestToProviderOptions {
  dseq: string;
  localCert?: LocalCert | null;
  chainNetwork: string;
}

export const sendManifestToProvider = async (providerInfo: ApiProviderList | undefined | null, manifest: unknown, options: SendManifestToProviderOptions) => {
  if (!providerInfo) return;
  console.log("Sending manifest to " + providerInfo?.owner);

  let jsonStr = JSON.stringify(manifest);
  jsonStr = jsonStr.replaceAll('"quantity":{"val', '"size":{"val');

  // Waiting for provider to have lease
  await wait(5000);

  let response: AxiosResponse | undefined;

  for (let i = 1; i <= 3 && !response; i++) {
    console.log("Try #" + i);
    try {
      if (!response) {
        response = await services.providerProxy.fetchProviderUrl(`/deployment/${options.dseq}/manifest`, {
          method: "PUT",
          certPem: options.localCert?.certPem,
          keyPem: options.localCert?.keyPem,
          body: jsonStr,
          timeout: 60_000,
          providerIdentity: providerInfo,
          chainNetwork: options.chainNetwork
        });
      }
    } catch (err) {
      if (typeof err === "string" && err.includes && err.includes("no lease for deployment") && i < 3) {
        console.log("Lease not found, retrying...");
        await wait(6000);
      } else {
        throw new Error((err as any)?.response?.data || err);
      }
    }
  }

  // Waiting for provider to boot up workload
  await wait(5000);

  return response;
};

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
