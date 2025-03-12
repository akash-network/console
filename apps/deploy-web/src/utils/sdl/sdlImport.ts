import yaml from "js-yaml";
import { nanoid } from "nanoid";

import { ExposeType, ProfileGpuModelType, ServiceType } from "@src/types";
import { CustomValidationError } from "../deploymentData";
import { capitalizeFirstLetter } from "../stringUtils";
import { defaultHttpOptions } from "./data";

export const importSimpleSdl = (yamlStr: string) => {
  try {
    const yamlJson = yaml.load(yamlStr) as any;
    const services: ServiceType[] = [];

    const sortedServicesNames = Object.keys(yamlJson.services).sort();
    sortedServicesNames.forEach(svcName => {
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

      // TODO validation
      // Service compute profile
      service.profile = {
        cpu: compute.resources.cpu.units,
        gpu: compute.resources.gpu ? compute.resources.gpu.units : 0,
        gpuModels: compute.resources.gpu ? getGpuModels(compute.resources.gpu.attributes.vendor) : [],
        hasGpu: !!compute.resources.gpu,
        ram: getResourceDigit(compute.resources.memory.size),
        ramUnit: getResourceUnit(compute.resources.memory.size),
        storage: storages.map(storage => {
          return {
            size: getResourceDigit(storage.size || "1Gi"),
            unit: getResourceUnit(storage.size || "1Gi"),
            isPersistent: storage.attributes?.persistent || false,
            type: storage.attributes?.class || "beta2",
            name: storage.name,
            mount: svc.params?.storage[storage.name]?.mount || "",
            isReadOnly: svc.params?.storage[storage.name]?.readOnly || false
          };
        })
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

        const _expose: ExposeType = {
          id: nanoid(),
          port: expose.port,
          as: expose.as || 80,
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

        service.expose?.push(_expose);
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

      services.push(service as ServiceType);
    });

    return services;
  } catch (error) {
    console.log(error);
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
