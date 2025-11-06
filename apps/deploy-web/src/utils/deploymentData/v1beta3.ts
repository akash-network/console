import type { Attribute } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { HttpClient } from "@akashnetwork/http-sdk";
import yaml from "js-yaml";

import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import type { DepositParams } from "@src/types/deployment";
import { CustomValidationError, getSdl, Manifest, ManifestVersion } from "./helpers";

export const ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
export const TRIAL_ATTRIBUTE = "console/trials";
export const TRIAL_REGISTERED_ATTRIBUTE = "console/trials-registered";
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
export const MANAGED_WALLET_ALLOWED_AUDITORS = [AUDITOR];

export function getManifest(yamlJson: any, asString: boolean) {
  return Manifest(yamlJson, "beta3", networkStore.selectedNetworkId, asString);
}

export async function getManifestVersion(yamlJson: any) {
  const version = await ManifestVersion(yamlJson, "beta3", networkStore.selectedNetworkId);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: any[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms[0];
};

export function appendTrialAttribute(yamlStr: string, attributeKey: string) {
  const sdl = getSdl(yamlStr, "beta3", networkStore.selectedNetworkId);
  const placementData = sdl.data?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.attributes) {
      value.attributes = [];
    } else if (!Array.isArray(value.attributes)) {
      value.attributes = Object.entries(value.attributes).map(([key, value]) => ({ key, value: value as string }));
    }

    const hasTrialAttribute = value.attributes.find(attr => attr.key === attributeKey);
    if (!hasTrialAttribute) {
      value.attributes.push({ key: attributeKey, value: "true" });
    }

    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    if (!value.signedBy.allOf.includes(AUDITOR)) {
      value.signedBy.allOf.push(AUDITOR);
    }
  }

  const result = yaml.dump(sdl.data, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty" // dump null as empty value
    },
    replacer: (key, value) => {
      const isCurrentKeyProviderAttributes = key === "attributes" && Array.isArray(value) && value.some(attr => attr.key === attributeKey);
      if (isCurrentKeyProviderAttributes) {
        return mapProviderAttributes(value);
      }
      return value;
    }
  });

  return `---
${result}`;
}

export function appendAuditorRequirement(yamlStr: string) {
  const sdl = getSdl(yamlStr, "beta3", networkStore.selectedNetworkId);
  const placementData = sdl.data?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    for (const auditor of MANAGED_WALLET_ALLOWED_AUDITORS) {
      if (!value.signedBy.anyOf.includes(auditor)) {
        value.signedBy.anyOf.push(auditor);
      }
    }
  }

  const result = yaml.dump(sdl.data, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
}

// Attributes is a key value pair object, but we store it as an array of objects with key and value
function mapProviderAttributes(attributes: Attribute[]) {
  return attributes?.reduce<Record<string, string>>((acc, curr) => ((acc[curr.key] = curr.value), acc), {});
}

export async function NewDeploymentData(
  chainApiHttpClient: HttpClient,
  yamlStr: string,
  dseq: string | null,
  fromAddress: string,
  deposit: number | DepositParams[] = browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT
) {
  try {
    const networkId = networkStore.selectedNetworkId;
    const sdl = getSdl(yamlStr, "beta3", networkId);
    const groups = sdl.groups();
    const mani = sdl.manifest();
    const denom = getDenomFromSdl(groups);
    const version = await sdl.manifestVersion();
    const _deposit = (Array.isArray(deposit) && deposit.find(d => d.denom === denom)) || { denom, amount: deposit.toString() };

    let finalDseq: string = dseq || "";
    if (!finalDseq) {
      const response = await chainApiHttpClient.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
      finalDseq = response.data.block.header.height;
    }

    return {
      sdl: sdl.data,
      manifest: mani,
      groups: groups,
      deploymentId: {
        owner: fromAddress,
        dseq: finalDseq
      },
      orderId: [],
      leaseId: [],
      hash: version,
      deposit: _deposit
    };
  } catch (e: any) {
    const error = new CustomValidationError(e.message);
    error.stack = e.stack;
    throw error;
  }
}
