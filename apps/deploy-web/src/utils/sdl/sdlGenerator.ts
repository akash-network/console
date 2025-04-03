import yaml from "js-yaml";

import type { ExposeType, ProfileGpuModelType, ServiceType } from "@src/types";
import { defaultHttpOptions } from "./data";

export const buildCommand = (command: string) => {
  if (command.trim() === "sh -c") {
    return ["sh", "-c"];
  }

  const lines = command.split("\n");

  if (lines.length > 1 || command.startsWith("sh -c")) {
    const commandWithoutEmptyLines =
      lines
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n") + "\n";
    return ["sh", "-c", commandWithoutEmptyLines.replace(/^sh -c\s*/, "")];
  }

  return command;
};

export const generateSdl = (services: ServiceType[], region?: string) => {
  const sdl: Record<string, any> = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };

  services.forEach(service => {
    sdl.services[service.title] = {
      image: service.image,

      credentials: service.hasCredentials ? service.credentials : undefined,

      // Expose
      expose: service.expose.map(e => {
        // Port
        const _expose: Record<string, any> = { port: e.port };

        // As
        if (e.as) {
          _expose["as"] = e.as;
        }

        // Accept
        const accept = e.accept?.map(a => a.value);
        if ((accept?.length || 0) > 0) {
          _expose["accept"] = accept;
        }

        // Proto
        const proto = getProto(e);
        if (proto) {
          _expose["proto"] = proto;
        }

        // To
        const to = e.to?.map(to => ({ ["service"]: to.value }));
        _expose["to"] = [
          {
            global: !!e.global,
            ...(e.ipName ? { ip: e.ipName } : {})
          }
        ].concat(to as any);

        // HTTP Options
        if (e.hasCustomHttpOptions) {
          _expose["http_options"] = {
            max_body_size: e.httpOptions?.maxBodySize ?? defaultHttpOptions.maxBodySize,
            read_timeout: e.httpOptions?.readTimeout ?? defaultHttpOptions.readTimeout,
            send_timeout: e.httpOptions?.sendTimeout ?? defaultHttpOptions.sendTimeout,
            next_cases: e.httpOptions?.nextCases ?? defaultHttpOptions.nextCases,
            next_tries: e.httpOptions?.nextTries ?? defaultHttpOptions.nextTries,
            next_timeout: e.httpOptions?.nextTimeout ?? defaultHttpOptions.nextTimeout
          };
        }

        return _expose;
      })
    };

    // Command
    const trimmedCommand = service.command?.command?.trim();
    if (trimmedCommand) {
      sdl.services[service.title].command = buildCommand(trimmedCommand);
      sdl.services[service.title].args = [service.command?.arg?.trim()];
    }

    // Env
    if ((service.env?.length || 0) > 0) {
      sdl.services[service.title].env = service.env?.map(e => `${e.key.trim()}=${e.isSecret ? "" : e.value?.trim()}`);
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
            size: `${service.profile.storage[0].size}${service.profile.storage[0].unit}`
          }
        ]
      }
    };

    // GPU
    if (service.profile.hasGpu) {
      sdl.profiles.compute[service.title].resources.gpu = {
        units: service.profile.gpu,
        attributes: {
          vendor: {}
        }
      };

      // Group models by vendor
      const vendors =
        service.profile.gpuModels?.reduce<Record<string, ProfileGpuModelType[]>>((group, model) => {
          const { vendor } = model;
          group[vendor] = group[vendor] ?? [];
          group[vendor].push(model);
          return group;
        }, {}) || {};

      for (const [vendor, models] of Object.entries(vendors)) {
        const mappedModels = models
          .map(x => {
            let model: { model?: string; ram?: string; interface?: string } | null = null;

            if (x.name) {
              model = {
                model: x.name
              };
            }

            if (model && x.memory) {
              model.ram = x.memory;
            }

            if (model && x.interface) {
              model.interface = x.interface;
            }

            return model;
          })
          .filter(x => x);

        sdl.profiles.compute[service.title].resources.gpu.attributes.vendor[vendor] = mappedModels.length > 0 ? mappedModels : null;
      }
    }

    // Persistent Storage
    if (service.profile.storage.length > 1) {
      sdl.services[service.title].params = {
        storage: {}
      };

      service.profile.storage.slice(1).forEach(storage => {
        if (storage.name) {
          sdl.services[service.title].params.storage[storage.name] = {
            mount: storage.mount,
            readOnly: !!storage.isReadOnly
          };
        }

        sdl.profiles.compute[service.title].resources.storage.push({
          name: storage.name,
          size: `${storage.size}${storage.unit}`,
          attributes: {
            persistent: storage.isPersistent,
            class: storage.type
          }
        });
      });
    }

    // Placement
    sdl.profiles.placement[service.placement.name] = sdl.profiles.placement[service.placement.name] || { pricing: {} };
    sdl.profiles.placement[service.placement.name].pricing[service.title] = {
      denom: service.placement.pricing.denom,
      amount: service.placement.pricing.amount
    };

    // Signed by
    if ((service.placement.signedBy?.anyOf?.length || 0) > 0 || (service.placement.signedBy?.anyOf?.length || 0) > 0) {
      if ((service.placement.signedBy?.anyOf?.length || 0) > 0) {
        sdl.profiles.placement[service.placement.name].signedBy = {
          anyOf: service.placement.signedBy?.anyOf.map(x => x.value)
        };
      }

      if ((service.placement.signedBy?.allOf?.length || 0) > 0) {
        sdl.profiles.placement[service.placement.name].signedBy.allOf = service.placement.signedBy?.allOf.map(x => x.value);
      }
    }

    // Attributes
    if ((service.placement.attributes?.length || 0) > 0) {
      sdl.profiles.placement[service.placement.name].attributes = service.placement.attributes?.reduce<Record<string, string>>(
        (acc, curr) => ((acc[curr.key] = curr.value), acc),
        {}
      );
    }

    // Regions
    if (!!region && region !== "any") {
      sdl.profiles.placement[service.placement.name].attributes = {
        ...(sdl.profiles.placement[service.placement.name].attributes || {}),
        "location-region": region.toLowerCase()
      };
    }

    // IP Lease
    if (service.expose.some(exp => exp.ipName)) {
      sdl["endpoints"] = {};

      service.expose
        .filter((exp): exp is ExposeType & { ipName: string } => !!exp.ipName)
        .forEach(exp => {
          sdl["endpoints"][exp.ipName] = {
            kind: "ip"
          };
        });
    }

    // Count
    sdl.deployment[service.title] = {
      [service.placement.name]: {
        profile: service.title,
        count: service.count
      }
    };
  });

  const result = yaml.dump(sdl, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty" // dump null as empty value
    }
  });

  return `---
${result}`;
};

const getProto = (expose: ExposeType) => {
  if (expose.proto && expose.proto === "http") {
    return null;
  } else {
    return expose.proto;
  }
};
