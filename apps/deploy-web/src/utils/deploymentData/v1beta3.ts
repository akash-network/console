import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import type { DepositParams } from "@src/types/deployment";
import { CustomValidationError, getCurrentHeight, getSdl, Manifest, ManifestVersion } from "./helpers";

export const endpointNameValidationRegex = /^[a-z]+[-_\da-z]+$/;

export function getManifest(yamlJson, asString: boolean) {
  const network = networkStore.getSelectedNetwork();
  return Manifest(yamlJson, "beta3", network.id, asString);
}

export async function getManifestVersion(yamlJson) {
  const network = networkStore.getSelectedNetwork();
  const version = await ManifestVersion(yamlJson, "beta3", network.id);

  return Buffer.from(version).toString("base64");
}

const getDenomFromSdl = (groups: any[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms[0];
};

export async function NewDeploymentData(
  apiEndpoint: string,
  yamlStr: string,
  dseq: string | null,
  fromAddress: string,
  deposit: number | DepositParams[] = browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT,
  depositorAddress: string | null = null
) {
  try {
    const { id: networkId } = networkStore.getSelectedNetwork();
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
