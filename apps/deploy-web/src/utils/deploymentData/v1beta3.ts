import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import type { DepositParams } from "@src/types/deployment";
import { CustomValidationError, getCurrentHeight, getSdl, Manifest, ManifestVersion } from "./helpers";
import yaml from "js-yaml";

export const endpointNameValidationRegex = /^[a-z]+[-_\da-z]+$/;
const trialAttribute = "console/trials";
const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export function getManifest(yamlJson, asString: boolean) {
  return Manifest(yamlJson, "beta3", networkStore.selectedNetworkId, asString);
}

export async function getManifestVersion(yamlJson) {
  const version = await ManifestVersion(yamlJson, "beta3", networkStore.selectedNetworkId);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: any[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms[0];
};

export function appendTrialAttribute(yamlStr: string) {
  const sdl = getSdl(yamlStr, "beta3", networkStore.selectedNetworkId);

  Object.keys(sdl.data.profiles.placement).forEach(placement => {
    if (!sdl.data.profiles.placement[placement].attributes) {
      sdl.data.profiles.placement[placement].attributes = [];
    }

    if (sdl.data.profiles.placement[placement].attributes.find(attr => attr.key === trialAttribute)) {
      return;
    } else {
      sdl.data.profiles.placement[placement].attributes.push({ key: trialAttribute, value: "true" });
    }

    if (!sdl.data.profiles.placement[placement].signedBy?.anyOf || !sdl.data.profiles.placement[placement].signedBy?.allOf) {
      sdl.data.profiles.placement[placement].signedBy = {
        anyOf: sdl.data.profiles.placement[placement].signedBy?.anyOf || [],
        allOf: sdl.data.profiles.placement[placement].signedBy?.allOf || []
      };
    }

    if (!sdl.data.profiles.placement[placement].signedBy.anyOf.includes(auditor) || !sdl.data.profiles.placement[placement].signedBy.allOf.includes(auditor)) {
      sdl.data.profiles.placement[placement].signedBy.anyOf.push(auditor);
    }
  });

  const result = yaml.dump(sdl.data, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty" // dump null as emtpy value
    }
  });

  return `---
${result}`;
}

export async function NewDeploymentData(
  apiEndpoint: string,
  yamlStr: string,
  dseq: string | null,
  fromAddress: string,
  deposit: number | DepositParams[] = browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT,
  depositorAddress: string | null = null
) {
  try {
    const networkId = networkStore.selectedNetworkId;
    const sdl = getSdl(yamlStr, "beta3", networkId);
    const groups = sdl.groups();
    const mani = sdl.manifest();
    const denom = getDenomFromSdl(groups);
    const version = await sdl.manifestVersion();
    const _deposit = (Array.isArray(deposit) && deposit.find(d => d.denom === denom)) || { denom, amount: deposit.toString() };

    return {
      sdl: sdl.data,
      manifest: mani,
      groups: groups,
      deploymentId: {
        owner: fromAddress,
        dseq: dseq || (await getCurrentHeight(apiEndpoint)).toString()
      },
      orderId: [],
      leaseId: [],
      version,
      deposit: _deposit,
      depositor: depositorAddress || fromAddress
    };
  } catch (e) {
    const error = new CustomValidationError(e.message);
    error.stack = e.stack;
    throw error;
  }
}
