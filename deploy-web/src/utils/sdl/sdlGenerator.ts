import { Expose, SdlBuilderFormValues } from "@src/types";
import yaml from "js-yaml";

export const generateSdl = (formData: SdlBuilderFormValues) => {
  const sdl = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };

  formData.services.forEach(service => {
    sdl.services[service.title] = {
      image: service.image,
      expose: service.expose.map(e => {
        // Port
        const _expose = { port: e.port };

        // As
        if (e.as) {
          _expose["as"] = e.as;
        }

        // Accept
        const accept = e.accept.map(a => a.value);
        if (accept?.length > 0) {
          _expose["accept"] = accept;
        }

        // Proto
        const proto = getProto(e);
        if (proto) {
          _expose["proto"] = proto;
        }

        // To
        const to = e.to.map(to => ({ ["service"]: to.value }));
        _expose["to"] = [
          {
            global: !!e.global
          }
        ].concat(to as any);

        return _expose;
      })
    };

    // Command
    const trimmedCommand = service.command?.command?.trim();
    if (trimmedCommand.length > 0) {
      sdl.services[service.title].command = trimmedCommand.split(" ").filter(x => x);
      sdl.services[service.title].args = [service.command?.arg?.trim()];
    }

    // Env
    if (service.env?.length > 0) {
      sdl.services[service.title].env = service.env.map(e => `${e.key.trim()}=${e.isSecret ? "" : e.value?.trim()}`);
    }

    // Compute
    sdl.profiles.compute[service.title] = {
      resources: {
        cpu: {
          units: service.profile.cpu
        },
        memory: {
          size: `${service.profile.ram}${service.profile.ramUnit}`
        },
        storage: [
          {
            size: `${service.profile.storage}${service.profile.storageUnit}`
          }
        ]
      }
    };

    // GPU
    if (service.profile.hasGpu) {
      sdl.profiles.compute[service.title].resources.gpu = {
        units: service.profile.gpu,
        attributes: {
          vendor: {
            [service.profile.gpuVendor]:
              service.profile.gpuModels.length > 0
                ? service.profile.gpuModels.map(x => {
                    const modelKey = x.key.split("/");
                    // capabilities/gpu/vendor/nvidia/model/h100 -> h100
                    return { model: modelKey[modelKey.length - 1] };
                  })
                : null
          }
        }
      };
    }

    // Persistent Storage
    if (service.profile.hasPersistentStorage) {
      sdl.services[service.title].params = {
        storage: {
          [service.profile.persistentStorageParam.name]: {
            mount: service.profile.persistentStorageParam.mount,
            readOnly: !!service.profile.persistentStorageParam.readOnly
          }
        }
      };

      sdl.profiles.compute[service.title].resources.storage.push({
        name: service.profile.persistentStorageParam.name,
        size: `${service.profile.persistentStorage}${service.profile.persistentStorageUnit}`,
        attributes: {
          persistent: true,
          class: service.profile.persistentStorageParam.type
        }
      });
    }

    // Placement
    sdl.profiles.placement[service.placement.name] = sdl.profiles.placement[service.placement.name] || { pricing: {} };
    sdl.profiles.placement[service.placement.name].pricing[service.title] = {
      denom: "uakt",
      amount: service.placement.pricing.amount
    };

    // Signed by
    if (service.placement.signedBy?.anyOf?.length > 0 || service.placement.signedBy?.anyOf?.length > 0) {
      if (service.placement.signedBy?.anyOf?.length > 0) {
        sdl.profiles.placement[service.placement.name].signedBy = {
          anyOf: service.placement.signedBy.anyOf.map(x => x.value)
        };
      }

      if (service.placement.signedBy?.allOf?.length > 0) {
        sdl.profiles.placement[service.placement.name].signedBy.allOf = service.placement.signedBy.allOf.map(x => x.value);
      }
    }

    // Attributes
    if (service.placement.attributes?.length > 0) {
      sdl.profiles.placement[service.placement.name].attributes = service.placement.attributes.reduce((acc, curr) => ((acc[curr.key] = curr.value), acc), {});
    }

    sdl.deployment[service.title] = {
      [service.placement.name]: {
        profile: service.title,
        count: service.count
      }
    };
  });

  const result = yaml.dump(sdl, {
    indent: 2,
    styles: {
      "!!null": "empty" // dump null as emtpy value
    }
  });

  return `---
${result}`;
};

const getProto = (expose: Expose) => {
  if (expose.proto && (expose.proto === "http" || expose.proto === "https")) {
    return null;
  } else {
    return expose.proto;
  }
};
