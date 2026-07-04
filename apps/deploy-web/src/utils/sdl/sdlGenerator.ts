import yaml from "js-yaml";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { ExposeType, PlacementType, ProfileGpuModelType, SdlBuilderFormValuesType } from "@src/types";
import type { TeeType } from "@src/utils/confidentialCompute";
import { TEE_TYPE_ATTRIBUTE_KEY } from "@src/utils/confidentialCompute";
import { defaultHttpOptions } from "./data";

/**
 * Converts the Command form field (one command-array token per line) into the
 * SDL `command` array. Tokens are trimmed and empty lines dropped. The user's
 * command is preserved verbatim — no shell wrapper (e.g. `sh -c`) is forced.
 */
export const buildCommand = (command: string): string[] => {
  return command
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
};

export const generateSdl = (formValues: SdlBuilderFormValuesType) => {
  const sdl: Record<string, any> = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };

  // Optional deployment-level reclamation requirement. Omitted entirely when unset ("Any"), which
  // signals the user has no minimum-window requirement.
  if (formValues.reclamationMinWindow) {
    sdl.reclamation = { min_window: formValues.reclamationMinWindow };
  }

  const placementById = new Map<string, PlacementType>(formValues.placements.map(p => [p.id, p]));

  // Derive each placement's Confidential Compute type from its services' `params.tee`. The TEE choice is
  // per-service, but the provider-matching requirement is per-placement/group; CON-449 guarantees all
  // services sharing a placement use the same TEE type (or none), so a single value per placement is safe.
  const teeTypeByPlacementId = new Map<string, TeeType>();
  formValues.services.forEach(service => {
    if (service.params?.tee) teeTypeByPlacementId.set(service.placementId, service.params.tee);
  });

  formValues.placements.forEach(placement => {
    sdl.profiles.placement[placement.name] = { pricing: {} };

    if ((placement.signedBy?.anyOf?.length || 0) > 0) {
      sdl.profiles.placement[placement.name].signedBy = {
        anyOf: placement.signedBy?.anyOf.map(x => x.value)
      };
    }

    if ((placement.signedBy?.allOf?.length || 0) > 0) {
      sdl.profiles.placement[placement.name].signedBy = sdl.profiles.placement[placement.name].signedBy || {};
      sdl.profiles.placement[placement.name].signedBy.allOf = placement.signedBy?.allOf.map(x => x.value);
    }

    if ((placement.attributes?.length || 0) > 0) {
      sdl.profiles.placement[placement.name].attributes = placement.attributes?.reduce<Record<string, string>>(
        (acc, curr) => ((acc[curr.key] = curr.value), acc),
        {}
      );
    }

    if (!!placement.region && placement.region !== "any") {
      sdl.profiles.placement[placement.name].attributes = {
        ...(sdl.profiles.placement[placement.name].attributes || {}),
        "location-region": placement.region.toLowerCase()
      };
    }

    // Auto-managed provider-matching requirement derived from the placement's TEE type, so only
    // TEE-capable providers bid/match. Stripped back out on import so it never becomes a hand-editable
    // attribute and can never duplicate on re-export.
    const teeType = teeTypeByPlacementId.get(placement.id);
    if (teeType) {
      sdl.profiles.placement[placement.name].attributes = {
        ...(sdl.profiles.placement[placement.name].attributes || {}),
        [TEE_TYPE_ATTRIBUTE_KEY]: teeType
      };
    }
  });

  formValues.services.forEach(service => {
    const placement = placementById.get(service.placementId);
    if (!placement) {
      throw new Error(`Service "${service.title}" references unknown placementId "${service.placementId}"`);
    }

    sdl.services[service.title] = {
      image: service.image,

      credentials: service.hasCredentials ? service.credentials : undefined,

      expose: service.expose.map(e => {
        const _expose: Record<string, any> = { port: e.port };

        if (e.as) {
          _expose["as"] = e.as;
        }

        const accept = e.accept?.map(a => a.value);
        if ((accept?.length || 0) > 0) {
          _expose["accept"] = accept;
        }

        const proto = getProto(e);
        if (proto) {
          _expose["proto"] = proto;
        }

        const to = e.to?.map(to => ({ ["service"]: to.value }));
        _expose["to"] = [
          {
            global: !!e.global,
            ...(e.ipName ? { ip: e.ipName } : {})
          }
        ].concat(to as any);

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

    const trimmedCommand = service.command?.command?.trim();
    if (trimmedCommand) {
      sdl.services[service.title].command = buildCommand(trimmedCommand);

      const arg = service.command?.arg;
      if (arg) {
        sdl.services[service.title].args = [arg];
      }
    }

    if ((service.env?.length || 0) > 0) {
      sdl.services[service.title].env = service.env?.map(e => `${e.key.trim()}=${e.isSecret ? "" : e.value?.trim()}`);
    }

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

    if (service.profile.hasGpu) {
      sdl.profiles.compute[service.title].resources.gpu = {
        units: service.profile.gpu,
        attributes: {
          vendor: {}
        }
      };

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

    if (isLogCollectorService(service)) {
      sdl.services[service.title].params = {
        ...sdl.services[service.title].params,
        permissions: {
          read: ["deployment", "logs", "events"]
        }
      };
    }

    // Preserve the TEE param through the round-trip even though the builder UI cannot edit it yet.
    if (service.params?.tee) {
      sdl.services[service.title].params = {
        ...sdl.services[service.title].params,
        tee: service.params.tee
      };
    }

    sdl.profiles.placement[placement.name].pricing[service.title] = {
      denom: service.pricing.denom,
      amount: service.pricing.amount
    };

    if (service.expose.some(exp => exp.ipName)) {
      sdl["endpoints"] = sdl["endpoints"] || {};

      service.expose
        .filter((exp): exp is ExposeType & { ipName: string } => !!exp.ipName)
        .forEach(exp => {
          sdl["endpoints"][exp.ipName] = {
            kind: "ip"
          };
        });
    }

    sdl.deployment[service.title] = {
      [placement.name]: {
        profile: service.title,
        count: service.count
      }
    };
  });

  const result = yaml.dump(sdl, {
    indent: 2,
    quotingType: '"',
    styles: {
      "!!null": "empty"
    }
  });

  return `---
${result}`;
};

/**
 * Returns the SDL proto value for an expose entry. SDL omits the proto field
 * for HTTP exposes (it is the default), so http maps to null.
 */
const getProto = (expose: ExposeType) => {
  if (expose.proto && expose.proto === "http") {
    return null;
  } else {
    return expose.proto;
  }
};
