import axios from "axios";
import { PROVIDER_PROXY_URL } from "./constants";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";

export const sendManifestToProvider = async (providerInfo, manifest, dseq: string, localCert: LocalCert) => {
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
        response = await axios.post(PROVIDER_PROXY_URL, {
          method: "PUT",
          url: providerInfo.host_uri + "/deployment/" + dseq + "/manifest",
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

async function wait(time) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res(true);
    }, time);
  });
}
