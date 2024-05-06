import { CustomValidationError, DeploymentGroups, getCurrentHeight, getSdl, Manifest, ManifestVersion, parseSizeStr } from "./helpers";
import { defaultInitialDeposit } from "../constants";
import { stringToBoolean } from "../stringUtils";
import path from "path";
import yaml from "js-yaml";
import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { NetworkId } from "@akashnetwork/akashjs/build/types/network";

export const endpointNameValidationRegex = /^[a-z]+[-_\da-z]+$/;

function validate(yamlStr: string, yamlJson, networkId: NetworkId) {
  try {
    // TODO: use result of this in client code instead of just using validation
    getSdl(yamlJson, "beta3", networkId);
  } catch (e) {
    const error = new CustomValidationError(e.message);
    error.stack = e.stack;
    throw error;
  }

  Object.keys(yamlJson.services).forEach(svcName => {
    const svc = yamlJson.services[svcName];
    const depl = yamlJson.deployment[svcName];

    Object.keys(depl).forEach(placementName => {
      const svcdepl = depl[placementName];
      const compute = yamlJson.profiles.compute[svcdepl.profile];

      // STORAGE VALIDATION
      const storages = compute.resources.storage.map ? compute.resources.storage : [compute.resources.storage];
      const volumes = {};
      const attr = {};
      const mounts = {};

      storages?.forEach(storage => {
        const name = storage.name || "default";
        volumes[name] = {
          name,
          quantity: { val: parseSizeStr(storage.size) },
          attributes:
            storage.attributes &&
            Object.keys(storage.attributes)
              .sort()
              .map(key => {
                const value = storage.attributes[key].toString();
                // add the storage attributes
                attr[key] = value;

                return {
                  key,
                  value
                };
              })
        };
      });

      if (svc.params) {
        (Object.keys(svc.params?.storage || {}) || []).forEach(name => {
          const params = svc.params.storage[name];
          if (!volumes[name]) {
            throw new CustomValidationError(`Service "${svcName}" references to no-existing compute volume names "${name}".`);
          }

          if (!path.isAbsolute(params.mount)) {
            throw new CustomValidationError(`Invalid value for "service.${svcName}.params.${name}.mount" parameter. expected absolute path.`);
          }

          // merge the service params attributes
          attr["mount"] = params.mount;
          attr["readOnly"] = params.readOnly || false;
          const mount = attr["mount"];
          const vlname = mounts[mount];

          if (vlname) {
            if (!mount) {
              throw new CustomValidationError("Multiple root ephemeral storages are not allowed");
            }

            throw new CustomValidationError(`Mount ${mount} already in use by volume ${vlname}.`);
          }

          mounts[mount] = name;
        });
      }

      (Object.keys(volumes) || []).forEach(volume => {
        volumes[volume].attributes?.forEach(nd => {
          attr[nd.key] = nd.value;
        });

        const persistent = stringToBoolean(attr["persistent"]);

        if (persistent && !attr["mount"]) {
          throw new CustomValidationError(
            `compute.storage.${volume} has persistent=true which requires service.${svcName}.params.storage.${volume} to have mount.`
          );
        }
      });

      // GPU VALIDATION
      const gpu = compute.resources.gpu;

      if (gpu) {
        if (gpu.units === 0 && gpu.attributes) {
          throw new CustomValidationError(`Invalid GPU configuration for "${svcName}".`);
        }

        if (gpu.units > 0 && !gpu.attributes) {
          throw new CustomValidationError(`Invalid GPU configuration for "${svcName}". Missing attributes with vendor and nvidia.`);
        }

        if (gpu.units > 0 && !("vendor" in gpu.attributes)) {
          throw new CustomValidationError(`Invalid GPU configuration for "${svcName}". Missing vendor with nvidia in attributes.`);
        }

        if (gpu.units > 0 && !("nvidia" in gpu.attributes.vendor)) {
          throw new CustomValidationError(`Invalid GPU configuration for "${svcName}". Missing nvidia in attributes.vendor.`);
        }

        if (gpu.units > 0 && !!gpu.attributes.vendor.nvidia && !Array.isArray(gpu.attributes.vendor.nvidia)) {
          throw new CustomValidationError(`Invalid GPU configuration for "${svcName}". Nvidia must be an array of GPU models with optional ram.`);
        }
      }
    });
  });
}

export function getManifest(yamlJson, asString: boolean) {
  const network = getSelectedNetwork();
  return Manifest(yamlJson, "beta3", network.id, asString);
}

export async function getManifestVersion(yamlJson, asString = false) {
  const network = getSelectedNetwork();
  const version = await ManifestVersion(yamlJson, "beta3", network.id);

  if (asString) {
    return Buffer.from(version).toString("base64");
  } else {
    return version;
  }
}

const getDenomFromSdl = (groups: any[]): string => {
  const denoms = groups.flatMap(g => g.resources).map(resource => resource.price.denom);

  // TODO handle multiple denoms in an sdl? (different denom for each service?)
  return denoms[0];
};

export async function NewDeploymentData(
  apiEndpoint: string,
  yamlStr: string,
  dseq: string,
  fromAddress: string,
  deposit = defaultInitialDeposit,
  depositorAddress = null
) {
  const { id: networkId } = getSelectedNetwork();
  const yamlJson = yaml.load(yamlStr) as any;

  // Validate the integrity of the yaml
  validate(yamlStr, yamlJson, networkId);

  const groups = DeploymentGroups(yamlJson, "beta3", networkId);
  const mani = Manifest(yamlJson, "beta3", networkId);
  const denom = getDenomFromSdl(groups);
  const version = await ManifestVersion(yamlJson, "beta3", networkId);
  const id = {
    owner: fromAddress,
    dseq: dseq
  };
  const _deposit = {
    denom,
    amount: deposit.toString()
  };

  if (!id.dseq) {
    id.dseq = (await getCurrentHeight(apiEndpoint)).toString();
  }

  return {
    sdl: yamlJson,
    manifest: mani,
    groups: groups,
    deploymentId: id,
    orderId: [],
    leaseId: [],
    version,
    deposit: _deposit,
    depositor: depositorAddress || fromAddress
  };
}
