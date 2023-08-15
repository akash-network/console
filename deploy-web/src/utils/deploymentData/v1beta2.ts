import { CustomValidationError, ManifestVersion, ParseServiceProtocol, getCurrentHeight, shouldBeIngress, parseSizeStr } from "./helpers";
import { defaultInitialDeposit } from "../constants";
import { stringToBoolean } from "../stringUtils";

const endpointNameValidationRegex = /^[a-z]+[-_\da-z]+$/;
const endpointKindIP = "ip";

const path = require("path");

const defaultHTTPOptions = {
  MaxBodySize: 1048576,
  ReadTimeout: 60000,
  SendTimeout: 60000,
  NextTries: 3,
  NextTimeout: 0,
  NextCases: ["error", "timeout"]
};

// TODO Enum
const Endpoint_SHARED_HTTP = 0;
const Endpoint_RANDOM_PORT = 1;
const Endpoint_LEASED_IP = 2;

// https://github.com/ovrclk/akash/blob/98fd6bd9c25014fb819f85a06168a3335dc9633f/x/deployment/types/v1beta2/validation_config.go
// const validationConfig = {
//   maxUnitCPU: 256 * 1000, // 256 CPUs
//   maxUnitMemory: 512 * unit.Gi, // 512 Gi
//   maxUnitStorage: 32 * unit.Ti, // 32 Ti
//   maxUnitCount: 50,
//   maxUnitPrice: 10000000, // 10akt

//   minUnitCPU: 10,
//   minUnitMemory: specSuffixes.Mi,
//   minUnitStorage: 5 * specSuffixes.Mi,
//   minUnitCount: 1,

//   maxGroupCount: 20,
//   maxGroupUnits: 20,

//   maxGroupCPU: 512 * 1000,
//   maxGroupMemory: 1024 * specSuffixes.Gi,
//   maxGroupStorage: 32 * specSuffixes.Ti
// };

function getHttpOptions(options = {}) {
  return {
    MaxBodySize: options["max_body_size"] || defaultHTTPOptions.MaxBodySize,
    ReadTimeout: options["read_timeout"] || defaultHTTPOptions.ReadTimeout,
    SendTimeout: options["send_timeout"] || defaultHTTPOptions.SendTimeout,
    NextTries: options["next_tries"] || defaultHTTPOptions.NextTries,
    NextTimeout: options["next_timeout"] || defaultHTTPOptions.NextTimeout,
    NextCases: options["next_cases"] || defaultHTTPOptions.NextCases
  };
}

// Port of: func (sdl *v2ComputeResources) toResourceUnits() types.ResourceUnits
export function toResourceUnits(computeResources) {
  if (!computeResources) return {};

  let units = {} as any;
  if (computeResources.cpu) {
    const cpu =
      typeof computeResources.cpu.units === "string" && computeResources.cpu.units.endsWith("m")
        ? computeResources.cpu.units.slice(0, -1)
        : (computeResources.cpu.units * 1000).toString();

    units.cpu = {
      units: { val: cpu },
      attributes:
        computeResources.cpu.attributes &&
        Object.keys(computeResources.cpu.attributes)
          .sort()
          .map(key => ({
            key: key,
            value: computeResources.cpu.attributes[key].toString()
          }))
    };
  }
  if (computeResources.memory) {
    units.memory = {
      quantity: { val: parseSizeStr(computeResources.memory.size) },
      attributes:
        computeResources.memory.attributes &&
        Object.keys(computeResources.memory.attributes)
          .sort()
          .map(key => ({
            key: key,
            value: computeResources.memory.attributes[key].toString()
          }))
    };
  }
  if (computeResources.storage) {
    const storages = computeResources.storage.map ? computeResources.storage : [computeResources.storage];
    units.storage =
      storages.map(storage => ({
        name: storage.name || "default",
        quantity: { val: parseSizeStr(storage.size) },
        attributes:
          storage.attributes &&
          Object.keys(storage.attributes)
            .sort()
            .map(key => ({
              key: key,
              value: storage.attributes[key].toString()
            }))
      })) || [];
  }

  units.endpoints = null;

  return units;
}

function computeEndpointSequenceNumbers(yamlJson) {
  let ipEndpointNames = {};

  Object.keys(yamlJson.services).forEach(svcName => {
    const svc = yamlJson.services[svcName];

    svc?.expose?.forEach(expose => {
      expose?.to
        ?.filter(to => to.global && to.ip?.length > 0)
        .map(to => to.ip)
        .sort()
        .forEach((ip, i) => {
          ipEndpointNames[ip] = i + 1;
        });
    });
  });

  return ipEndpointNames;
}

function DeploymentGroups(yamlJson) {
  let groups = {};
  const ipEndpointNames = computeEndpointSequenceNumbers(yamlJson);

  Object.keys(yamlJson.services).forEach(svcName => {
    const svc = yamlJson.services[svcName];
    const depl = yamlJson.deployment[svcName];

    Object.keys(depl).forEach(placementName => {
      const svcdepl = depl[placementName];
      const compute = yamlJson.profiles.compute[svcdepl.profile];
      const infra = yamlJson.profiles.placement[placementName];
      const price = infra.pricing[svcdepl.profile];

      price.amount = price.amount.toString(); // Interpreted as number otherwise

      let group = groups[placementName];

      if (!group) {
        group = {
          name: placementName,
          requirements: {
            attributes: infra.attributes ? Object.keys(infra.attributes).map(key => ({ key: key, value: infra.attributes[key]?.toString() })) : [],
            signed_by: {
              all_of: infra.signedBy?.allOf || [],
              any_of: infra.signedBy?.anyOf || []
            }
          },
          resources: []
        };

        if (group.requirements.attributes) {
          group.requirements.attributes = group.requirements.attributes.sort((a, b) => a.key < b.key);
        }

        groups[group.name] = group;
      }

      const resources = {
        resources: toResourceUnits(compute.resources), // Chanded resources => unit
        price: price,
        count: svcdepl.count
      };

      let endpoints = [];
      svc?.expose?.forEach(expose => {
        expose?.to
          ?.filter(to => to.global)
          .forEach(to => {
            const proto = ParseServiceProtocol(expose.proto);

            const v = {
              port: expose.port,
              externalPort: expose.as || 0,
              proto: proto,
              service: to.service || null,
              global: !!to.global,
              hosts: expose.accept || null,
              HTTPOptions: getHttpOptions(expose["http_options"]),
              IP: to.ip || ""
            };

            // Check to see if an IP endpoint is also specified
            if (to.ip?.length > 0) {
              const seqNo = ipEndpointNames[to.ip];
              (v as any).EndpointSequenceNumber = seqNo || 0;
              endpoints.push({ kind: Endpoint_LEASED_IP, sequence_number: seqNo });
            }

            let kind = Endpoint_RANDOM_PORT;

            if (shouldBeIngress(v)) {
              kind = Endpoint_SHARED_HTTP;
            }

            endpoints.push({ kind: kind, sequence_number: 0 }); // TODO
          });
      });

      resources.resources.endpoints = endpoints;
      group.resources.push(resources);
    });
  });

  let names = Object.keys(groups);

  names = names.sort();

  let result = names.map(name => groups[name]);
  // console.log(result);
  return result;
}

function validate(yamlJson) {
  // ENDPOINT VALIDATION
  if (yamlJson.endpoints) {
    Object.keys(yamlJson.endpoints).forEach(endpoint => {
      const _endpoint = yamlJson.endpoints[endpoint];
      if (!endpointNameValidationRegex.test(endpoint)) {
        throw new CustomValidationError(`Endpoint named "${endpoint}" is not a valid name.`);
      }

      if (!_endpoint.kind) {
        throw new CustomValidationError(`Endpoint named "${endpoint}" has no kind.`);
      }

      if (_endpoint.kind !== endpointKindIP) {
        throw new CustomValidationError(`Endpoint named "${endpoint}" has an unknown kind "${_endpoint.kind}".`);
      }
    });
  }

  const endpointsUsed = {};
  const portsUsed = {};
  Object.keys(yamlJson.services).forEach(svcName => {
    const svc = yamlJson.services[svcName];
    const depl = yamlJson.deployment[svcName];

    if (!depl) {
      throw new CustomValidationError(`Service "${svcName}" is not defined in the "deployment" section.`);
    }

    Object.keys(depl).forEach(placementName => {
      const svcdepl = depl[placementName];
      const compute = yamlJson.profiles.compute[svcdepl.profile];
      const infra = yamlJson.profiles.placement[placementName];

      if (!infra) {
        throw new CustomValidationError(`The placement "${placementName}" is not defined in the "placement" section.`);
      }

      const price = infra.pricing[svcdepl.profile];

      if (!price) {
        throw new CustomValidationError(`The pricing for the "${svcdepl.profile}" profile is not defined in the "${placementName}" "placement" definition.`);
      }

      if (!compute) {
        throw new CustomValidationError(`The compute requirements for the "${svcdepl.profile}" profile are not defined in the "compute" section.`);
      }

      // LEASE IP VALIDATION
      svc.expose?.forEach(expose => {
        const proto = ParseServiceProtocol(expose.proto);

        expose.to?.forEach(to => {
          if (to.ip?.length > 0) {
            if (!to.global) {
              throw new CustomValidationError(`Error on "${svcName}", if an IP is declared, the directive must be declared as global.`);
            }

            const endpointExists = yamlJson.endpoints && yamlJson.endpoints[to.ip];
            if (!endpointExists) {
              throw new CustomValidationError(`Unknown endpoint "${to.ip}" in service "${svcName}". Add to the list of endpoints in the "endpoints" section.`);
            }

            endpointsUsed[to.ip] = {};

            // Endpoint exists. Now check for port collisions across a single endpoint, port, & protocol
            const portKey = `${to.ip}-${expose.as}-${proto}`;
            const otherServiceName = portsUsed[portKey];
            if (otherServiceName) {
              throw new CustomValidationError(
                `IP endpoint ${to.ip} port: ${expose.port} protocol: ${proto} specified by service ${svcName} already in use by ${otherServiceName}`
              );
            }
          }
        });
      });

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
    });
  });

  // ENDPOINT DUPLICATE VALIDATION
  if (yamlJson.endpoints) {
    Object.keys(yamlJson.endpoints).forEach(endpoint => {
      const isInUse = endpointsUsed[endpoint];
      if (!isInUse) {
        throw new CustomValidationError(`Endpoint ${endpoint} declared but never used.`);
      }
    });
  }
}

function DepositFromFlags(deposit) {
  return {
    denom: "uakt",
    amount: deposit.toString()
  };
}

// Port of:    func (sdl *v2) Manifest() (manifest.Manifest, error
export function Manifest(yamlJson) {
  let groups = {};

  const ipEndpointNames = computeEndpointSequenceNumbers(yamlJson);

  const sortedServicesNames = Object.keys(yamlJson.services).sort();
  sortedServicesNames.forEach(svcName => {
    const svc = yamlJson.services[svcName];
    const depl = yamlJson.deployment[svcName];

    const sortedPlacementNames = Object.keys(depl).sort();
    sortedPlacementNames.forEach(placementName => {
      const svcdepl = depl[placementName];
      let group = groups[placementName];

      if (!group) {
        group = {
          Name: placementName,
          Services: []
        };
        groups[placementName] = group;
      }

      const compute = yamlJson.profiles.compute[svcdepl.profile];
      const manifestResources = toResourceUnits(compute.resources);
      let manifestExpose = [];

      svc.expose?.forEach(expose => {
        const proto = ParseServiceProtocol(expose.proto);

        if (expose.to && expose.to.length > 0) {
          expose.to.forEach(to => {
            let seqNo = null;

            if (to.global && to.ip?.length > 0) {
              const endpointExists = yamlJson.endpoints && yamlJson.endpoints[to.ip];

              if (!endpointExists) {
                throw new CustomValidationError(`Unknown endpoint "${to.ip}". Add to the list of endpoints in the "endpoints" section.`);
              }

              seqNo = ipEndpointNames[to.ip];
              manifestResources.endpoints = [{ kind: Endpoint_LEASED_IP, sequence_number: seqNo }];
            }

            const _expose = {
              Port: expose.port,
              ExternalPort: expose.as || 0,
              Proto: proto,
              Service: to.service || "",
              Global: !!to.global,
              Hosts: expose.accept || null,
              HTTPOptions: getHttpOptions(expose["http_options"]),
              IP: to.ip || "",
              EndpointSequenceNumber: seqNo || 0
            };

            manifestExpose = manifestExpose.concat([_expose]);
          });
        } else {
          const _expose = {
            Port: expose.port,
            ExternalPort: expose.as || 0,
            Proto: proto,
            Service: "",
            Global: false,
            Hosts: expose.accept?.items || null,
            HTTPOptions: getHttpOptions(expose["http_options"]),
            IP: ""
          };

          manifestExpose = manifestExpose.concat([_expose]);
        }
      });

      const msvc: any = {
        Name: svcName,
        Image: svc.image,
        Command: svc.command || null,
        Args: svc.args || null,
        Env: svc.env || null,
        Resources: manifestResources,
        Count: svcdepl.count,
        Expose: manifestExpose
      };

      if (svc.params) {
        msvc.params = {
          Storage: []
        };

        (Object.keys(svc.params?.storage) || []).forEach(name => {
          msvc.params.Storage.push({
            name: name,
            mount: svc.params.storage[name].mount,
            readOnly: svc.params.storage[name].readOnly || false
          });
        });
      }

      // stable ordering for the Expose portion
      msvc.Expose =
        msvc.Expose &&
        msvc.Expose.sort((a, b) => {
          if (a.Service !== b.Service) {
            return a.Service < b.Service;
          }
          if (a.Port !== b.Port) {
            return a.Port < b.Port;
          }
          if (a.Proto !== b.Proto) {
            return a.Proto < b.Proto;
          }
          if (a.Global !== b.Global) {
            return a.Global < b.Global;
          }
          return false;
        });

      group.Services.push(msvc);
    });
  });

  let names = Object.keys(groups);

  names = names.sort();

  let result = names.map(name => groups[name]);
  return result;
}

export async function getManifestVersion(yamlJson) {
  const mani = Manifest(yamlJson);
  const version = await ManifestVersion(mani);

  return version;
}

export async function NewDeploymentData(apiEndpoint, yamlJson, dseq, fromAddress, deposit = defaultInitialDeposit, depositorAddress = null) {
  // Validate the integrity of the yaml
  validate(yamlJson);

  const groups = DeploymentGroups(yamlJson);
  const mani = Manifest(yamlJson);
  const ver = await ManifestVersion(mani);
  const id = {
    owner: fromAddress,
    dseq: dseq
  };
  const _deposit = DepositFromFlags(deposit);

  if (!id.dseq) {
    id.dseq = await getCurrentHeight(apiEndpoint);
  }

  return {
    sdl: yamlJson,
    manifest: mani,
    groups: groups,
    deploymentId: id,
    orderId: [],
    leaseId: [],
    version: ver,
    deposit: _deposit,
    depositor: depositorAddress || fromAddress
  };
}
