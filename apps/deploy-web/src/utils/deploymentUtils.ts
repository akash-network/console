import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { ApiProviderList } from "@src/types/provider";
import { wait } from "./timer";

export const sendManifestToProvider = async (providerInfo: ApiProviderList, manifest: any, dseq: string, localCert: LocalCert) => {
  console.log("Sending manifest to " + providerInfo?.owner);

  let jsonStr = JSON.stringify(manifest);
  jsonStr = jsonStr.replaceAll('"quantity":{"val', '"size":{"val');

  // Waiting for 5 sec for provider to have lease
  await wait(5000);

  let response;

  for (let i = 1; i <= 3; i++) {
    console.log("Try #" + i);
    try {
      if (!response) {
        response = await axios.post(browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL, {
          method: "PUT",
          url: providerInfo.hostUri + "/deployment/" + dseq + "/manifest",
          certPem: localCert?.certPem,
          keyPem: localCert?.keyPem,
          body: jsonStr,
          timeout: 60_000
        });

        i = 3;
      }
    } catch (err) {
      if (err.includes && err.includes("no lease for deployment") && i < 3) {
        console.log("Lease not found, retrying...");
        await wait(6000); // Waiting for 6 sec
      } else {
        throw new Error(err?.response?.data || err);
      }
    }
  }

  // Waiting for 5 sec for provider to boot up workload
  await wait(5000);

  return response;
};

/**
 * Validate values to change in the template
 */
export function validateDeploymentData(deploymentData, selectedTemplate?) {
  if (selectedTemplate?.valuesToChange) {
    for (const valueToChange of selectedTemplate.valuesToChange) {
      if (valueToChange.field === "accept" || valueToChange.field === "env") {
        const serviceNames = Object.keys(deploymentData.sdl.services);
        for (const serviceName of serviceNames) {
          if (
            deploymentData.sdl.services[serviceName].expose?.some(e => e.accept?.includes(valueToChange.initialValue)) ||
            deploymentData.sdl.services[serviceName].env?.some(e => e?.includes(valueToChange.initialValue))
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
