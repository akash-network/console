import type { Attribute } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Manifest as AkashManifest, SDLInput } from "@akashnetwork/chain-sdk/web";
import { generateManifestVersion } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import yaml from "js-yaml";

import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import type { DepositParams } from "@src/types/deployment";
import { buildManifest, CustomValidationError, Manifest, ManifestVersion, parseSdlInput } from "./helpers";

export const ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
export const TRIAL_ATTRIBUTE = "console/trials";
export const TRIAL_REGISTERED_ATTRIBUTE = "console/trials-registered";
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
export const MANAGED_WALLET_ALLOWED_AUDITORS = [AUDITOR];

export function getManifest(yamlJson: any, asString: boolean): AkashManifest {
  return Manifest(yamlJson, "beta3", networkStore.selectedNetworkId, asString);
}

export async function getManifestVersion(yamlJson: any) {
  const version = await ManifestVersion(yamlJson, "beta3", networkStore.selectedNetworkId);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: GroupSpec[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price?.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms.find(d => !!d)!;
};

export function appendTrialAttribute(yamlStr: string, attributeKey: string) {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.attributes) {
      value.attributes = {};
    } else if (Array.isArray(value.attributes)) {
      value.attributes = (value.attributes as unknown as Attribute[]).reduce<Record<string, unknown>>((acc, curr) => ((acc[curr.key] = curr.value), acc), {});
    }

    const attrs = value.attributes as Record<string, unknown>;
    if (!(attributeKey in attrs)) {
      attrs[attributeKey] = "true";
    }

    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    if (value?.signedBy?.allOf && !value.signedBy.allOf.includes(AUDITOR)) {
      value.signedBy.allOf.push(AUDITOR);
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty" // dump null as empty value
    }
  });

  return `---
${result}`;
}

export function appendAuditorRequirement(yamlStr: string) {
  const sdlData = yaml.load(yamlStr) as SDLInput;
  const placementData = sdlData?.profiles?.placement || {};

  for (const [, value] of Object.entries(placementData)) {
    if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
      value.signedBy = {
        anyOf: value.signedBy?.anyOf || [],
        allOf: value.signedBy?.allOf || []
      };
    }

    for (const auditor of MANAGED_WALLET_ALLOWED_AUDITORS) {
      if (value?.signedBy?.anyOf && !value.signedBy.anyOf.includes(auditor)) {
        value.signedBy.anyOf.push(auditor);
      }
    }
  }

  const result = yaml.dump(sdlData, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
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
    const sdlInput = parseSdlInput(yamlStr);
    const manifest = buildManifest(sdlInput, networkId);
    const groups = manifest.groupSpecs;
    const mani = manifest.groups;
    const denom = getDenomFromSdl(groups);
    const version = await generateManifestVersion(manifest.groups);
    const _deposit = (Array.isArray(deposit) && deposit.find(d => d.denom === denom)) || { denom, amount: deposit.toString() };

    let finalDseq: string = dseq || "";
    if (!finalDseq) {
      const response = await chainApiHttpClient.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
      finalDseq = response.data.block.header.height;
    }

    return {
      sdl: sdlInput,
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
