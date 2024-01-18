import { Expose, ImportService } from "@src/types";
import { nanoid } from "nanoid";
import { capitalizeFirstLetter } from "../stringUtils";
import yaml from "js-yaml";
import { CustomValidationError } from "../deploymentData";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { defaultHttpOptions } from "./data";

export const importSimpleSdl = (yamlStr: string, providerAttributesSchema: ProviderAttributesSchema) => {
  try {
    const yamlJson = yaml.load(yamlStr) as any;
    const services: ImportService[] = [];

    const sortedServicesNames = Object.keys(yamlJson.services).sort();
    sortedServicesNames.forEach(svcName => {
      const svc = yamlJson.services[svcName];

      const service: ImportService = {
        id: nanoid(),
        title: svcName,
        image: svc.image
      };

      const compute = yamlJson.profiles.compute[svcName];
      const storages = compute.resources.storage.map ? compute.resources.storage : [compute.resources.storage];
      const persistentStorage = storages.find(s => s.attributes?.persistent === true);
      const hasPersistentStorage = !!persistentStorage;
      const ephStorage = storages.find(s => !s.attributes);
      const persistentStorageName = hasPersistentStorage ? persistentStorage.name : "data";

      // TODO validation
      // Service compute profile
      service.profile = {
        cpu: compute.resources.cpu.units,
        gpu: compute.resources.gpu ? compute.resources.gpu.units : 1,
        gpuVendor: compute.resources.gpu ? getGpuVendor(compute.resources.gpu.attributes.vendor) : "nvidia",
        gpuModels: compute.resources.gpu ? getGpuModels(compute.resources.gpu.attributes.vendor, providerAttributesSchema) : [],
        hasGpu: !!compute.resources.gpu,
        ram: getResourceDigit(compute.resources.memory.size),
        ramUnit: getResourceUnit(compute.resources.memory.size),
        storage: getResourceDigit(ephStorage.size),
        storageUnit: getResourceUnit(ephStorage.size),
        hasPersistentStorage,
        persistentStorage: hasPersistentStorage ? getResourceDigit(persistentStorage?.size) : 10,
        persistentStorageUnit: hasPersistentStorage ? getResourceUnit(persistentStorage?.size) : "Gi",
        persistentStorageParam: {
          name: persistentStorageName,
          type: hasPersistentStorage ? persistentStorage?.attributes?.class : "beta2",
          mount: hasPersistentStorage ? svc.params?.storage[persistentStorageName]?.mount : "",
          readOnly: hasPersistentStorage ? svc.params?.storage[persistentStorageName]?.readOnly : false
        }
      };

      // Command
      service.command = {
        command: svc.command?.length > 0 ? svc.command.join(" ") : "",
        arg: svc.args ? svc.args[0] : ""
      };

      // Env
      service.env = svc.env?.map(e => ({ id: nanoid(), key: e.split("=")[0], value: e.split("=")[1] })) || [];

      // Expose
      service.expose = [];
      svc.expose?.forEach(expose => {
        const isGlobal = expose.to.find(t => t.global);

        const _expose: Expose = {
          id: nanoid(),
          port: expose.port,
          as: expose.as,
          proto: expose.proto === "tcp" ? expose.proto : "http",
          global: !!isGlobal,
          to: expose.to.filter(t => t.global === undefined).map(t => ({ id: nanoid(), value: t.service })),
          accept: expose.accept?.map(a => ({ id: nanoid(), value: a })) || [],
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

        service.expose.push(_expose);
      });

      // Placement
      const depl = yamlJson.deployment[svcName];
      const sortedPlacementNames = Object.keys(depl).sort();
      // Only one placement available
      const placementName = sortedPlacementNames[0];
      const placement = yamlJson.profiles.placement[placementName];

      if (!placement) {
        throw new CustomValidationError(`Unable to find placement: ${placementName}`);
      }

      const placementPricing = placement.pricing[svcName];
      const deployment = depl[placementName];

      service.placement = {
        name: placementName,
        pricing: {
          amount: placementPricing.amount,
          denom: placementPricing.denom
        },
        signedBy: {
          anyOf: placement.signedBy && placement.signedBy?.anyOf ? placement.signedBy.anyOf.map(x => ({ id: nanoid(), value: x })) : [],
          allOf: placement.signedBy && placement.signedBy?.allOf ? placement.signedBy.allOf.map(x => ({ id: nanoid(), value: x })) : []
        },
        attributes: placement.attributes
          ? Object.keys(placement.attributes).map(attKey => {
              const attVal = placement.attributes[attKey];

              return {
                id: nanoid(),
                key: attKey,
                value: attVal
              };
            })
          : []
      };

      service.count = deployment.count;

      services.push(service);
    });

    return services;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getResourceDigit = (size: string): number => {
  return parseFloat(size.match(/\d+/g)[0]);
};

const getResourceUnit = (size: string): string => {
  return capitalizeFirstLetter(size.match(/[a-zA-Z]+/g)[0]);
};

const getGpuVendor = (vendorKey: { [key: string]: any }): string => {
  const vendor = Object.keys(vendorKey)[0];

  // For now only nvidia is supported
  return vendor || "nvidia";
};

const getGpuModels = (
  vendor: { [key: string]: { model: string }[] },
  providerAttributesSchema: ProviderAttributesSchema
): ProviderAttributeSchemaDetailValue[] => {
  const models = vendor.nvidia
    ? vendor.nvidia
        .map(m => {
          const model = providerAttributesSchema["hardware-gpu-model"].values.find(v => {
            const modelKey = v.key.split("/");
            // capabilities/gpu/vendor/nvidia/model/h100 -> h100
            return m.model === modelKey[modelKey.length - 1];
          }) as ProviderAttributeSchemaDetailValue;
          return model;
        })
        .filter(m => m)
    : [];

  return models;
};
