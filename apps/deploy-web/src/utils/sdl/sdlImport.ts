import yaml from "js-yaml";
import { nanoid } from "nanoid";

import type { ExposeType, PlacementAttributeType, PlacementType, ProfileGpuModelType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { CustomValidationError } from "../deploymentData";
import { capitalizeFirstLetter } from "../stringUtils";
import { defaultHttpOptions } from "./data";

export const parseSvcCommand = (command?: string | string[]): string => {
  if (!command) {
    return "";
  }

  if (typeof command === "string") {
    return parseSvcCommand([command]);
  }

  return command.filter(Boolean).join("\n");
};

export const importSimpleSdl = (yamlStr: string): SdlBuilderFormValuesType => {
  try {
    const yamlJson = yaml.load(yamlStr) as any;
    const placements: PlacementType[] = [];
    const placementIdByName = new Map<string, string>();
    const services: ServiceType[] = [];

    if (!yamlJson || typeof yamlJson !== "object" || Array.isArray(yamlJson)) {
      throw new CustomValidationError("SDL root must be a YAML object.");
    }

    if (!yamlJson.services) return { placements, services };

    Object.keys(yamlJson.services).forEach(svcName => {
      const svc = yamlJson.services[svcName];

      const service: Partial<ServiceType> = {
        id: nanoid(),
        title: svcName,
        image: svc.image,
        hasCredentials: !!svc.credentials,
        credentials: svc.credentials
      };

      const compute = yamlJson.profiles.compute[svcName];
      const storages = compute.resources.storage.map ? compute.resources.storage : [compute.resources.storage];

      service.profile = {
        cpu: compute.resources.cpu.units,
        gpu: compute.resources.gpu ? compute.resources.gpu.units : 0,
        gpuModels: compute.resources.gpu ? getGpuModels(compute.resources.gpu.attributes.vendor) : [],
        hasGpu: !!compute.resources.gpu,
        ram: getResourceDigit(compute.resources.memory.size),
        ramUnit: getResourceUnit(compute.resources.memory.size),
        storage: storages.map((storage: any) => {
          const type = storage.attributes?.class || "beta3";
          const isPersistent = storage.attributes?.persistent || false;
          const isReadOnly = svc.params?.storage?.[storage.name]?.readOnly || false;

          if (type === "ram") {
            if (isPersistent) {
              throw new CustomValidationError(`A storage of class "ram" cannot be persistent.`);
            }

            if (isReadOnly) {
              throw new CustomValidationError(`A storage of class "ram" cannot be read-only.`);
            }
          }

          return {
            size: getResourceDigit(storage.size || "1Gi"),
            unit: getResourceUnit(storage.size || "1Gi"),
            isPersistent,
            type,
            name: storage.name,
            mount: svc.params?.storage?.[storage.name]?.mount || "",
            isReadOnly
          };
        })
      };

      service.command = {
        command: parseSvcCommand(svc.command),
        arg: svc.args ? svc.args[0] : ""
      };

      service.env = svc.env?.map((e: any) => ({ id: nanoid(), key: e.split("=")[0], value: e.split("=")[1] })) || [];

      service.expose = [];
      svc.expose?.forEach((expose: any) => {
        const isGlobal = expose.to.find((t: any) => t.global);

        const _expose: ExposeType = {
          id: nanoid(),
          port: expose.port,
          as: expose.as || 80,
          proto: expose.proto === "tcp" ? expose.proto : "http",
          global: !!isGlobal,
          to: expose.to.filter((t: any) => t.global === undefined).map((t: any) => ({ id: nanoid(), value: t.service })),
          accept: expose.accept?.map((a: string) => ({ id: nanoid(), value: a })) || [],
          ipName: isGlobal?.ip ? isGlobal.ip : "",
          hasCustomHttpOptions: !!expose.http_options,
          httpOptions: {
            maxBodySize: expose.http_options?.max_body_size ?? defaultHttpOptions.maxBodySize,
            readTimeout: expose.http_options?.read_timeout ?? defaultHttpOptions.readTimeout,
            sendTimeout: expose.http_options?.send_timeout ?? defaultHttpOptions.sendTimeout,
            nextCases: expose.http_options?.next_cases ?? defaultHttpOptions.nextCases,
            nextTries: expose.http_options?.next_tries ?? defaultHttpOptions.nextTries,
            nextTimeout: expose.http_options?.next_timeout ?? defaultHttpOptions.nextTimeout
          }
        };

        service.expose?.push(_expose);
      });

      const depl = yamlJson.deployment[svcName];
      const sortedPlacementNames = Object.keys(depl).sort();
      const placementName = sortedPlacementNames[0];
      const placementProfile = yamlJson.profiles.placement[placementName];

      if (!placementProfile) {
        throw new CustomValidationError(`Unable to find placement: ${placementName}`);
      }

      let placementId = placementIdByName.get(placementName);
      if (!placementId) {
        placementId = nanoid();
        placementIdByName.set(placementName, placementId);
        placements.push(hydratePlacement(placementId, placementName, placementProfile));
      }

      const placementPricing = placementProfile.pricing?.[svcName];
      if (!placementPricing) {
        throw new CustomValidationError(`Unable to find pricing for service "${svcName}" in placement "${placementName}"`);
      }
      const deployment = depl[placementName];

      service.placementId = placementId;
      service.pricing = {
        amount: placementPricing.amount,
        denom: placementPricing.denom
      };

      service.count = deployment.count;

      services.push(service as ServiceType);
    });

    return { placements, services };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getResourceDigit = (size: string): number => {
  const match = size.match(/\d+/g);
  return match ? parseFloat(match[0]) : 0;
};

const getResourceUnit = (size: string): string => {
  const match = size.match(/[a-zA-Z]+/g);
  return match ? capitalizeFirstLetter(match[0]) : "";
};

const getGpuModels = (vendor: { [key: string]: { model: string; ram: string; interface: string }[] }): ProfileGpuModelType[] => {
  const models: ProfileGpuModelType[] = [];

  for (const [vendorName, vendorModels] of Object.entries(vendor)) {
    if (vendorModels) {
      vendorModels.forEach(m => {
        models.push({
          vendor: vendorName,
          name: m.model,
          memory: m.ram || "",
          interface: m.interface || ""
        });
      });
    } else {
      models.push({
        vendor: vendorName,
        name: "",
        memory: "",
        interface: ""
      });
    }
  }

  return models;
};

/**
 * Builds a fresh PlacementType from a raw SDL placement profile, lifting the
 * location-region attribute into a first-class field and dropping it from the
 * remaining attributes list.
 */
function hydratePlacement(id: string, name: string, profile: any): PlacementType {
  const rawAttributes: Record<string, string> = profile.attributes || {};
  const attributes: PlacementAttributeType[] = [];
  let region: string | undefined;

  for (const [key, value] of Object.entries(rawAttributes)) {
    if (key === "location-region") {
      region = value;
      continue;
    }
    attributes.push({ id: nanoid(), key, value });
  }

  return {
    id,
    name,
    region,
    attributes,
    signedBy: {
      anyOf: profile.signedBy?.anyOf ? profile.signedBy.anyOf.map((x: string) => ({ id: nanoid(), value: x })) : [],
      allOf: profile.signedBy?.allOf ? profile.signedBy.allOf.map((x: string) => ({ id: nanoid(), value: x })) : []
    }
  };
}
