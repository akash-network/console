import { describe, expect, it } from "vitest";

import {
  computeSidecarCarveout,
  formatTeeTypeLabel,
  getDeclaredTeeTypes,
  getDeclaredTeeTypesFromYaml,
  getServiceComputeResources,
  getServiceTeeType,
  getTeeServiceCarveouts,
  MIN_PRIMARY_CPU_MILLICORES,
  MIN_PRIMARY_MEMORY_BYTES,
  omitAttestationSidecar,
  SIDECAR_CPU_LIMIT_MILLICORES,
  SIDECAR_MEMORY_LIMIT_BYTES
} from "./confidentialCompute";

const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

describe(getDeclaredTeeTypes.name, () => {
  it("returns an empty array for nullish or empty manifests", () => {
    expect(getDeclaredTeeTypes(undefined)).toEqual([]);
    expect(getDeclaredTeeTypes(null)).toEqual([]);
    expect(getDeclaredTeeTypes({})).toEqual([]);
    expect(getDeclaredTeeTypes({ services: {} })).toEqual([]);
  });

  it("returns the single declared type for a one-service deployment", () => {
    expect(getDeclaredTeeTypes({ services: { web: { params: { tee: "cpu" } } } })).toEqual(["cpu"]);
    expect(getDeclaredTeeTypes({ services: { web: { params: { tee: "cpu-gpu" } } } })).toEqual(["cpu-gpu"]);
  });

  it("returns the distinct set in canonical order for mixed multi-service deployments", () => {
    const manifest = {
      services: {
        gpuApp: { params: { tee: "cpu-gpu" } },
        cpuApp: { params: { tee: "cpu" } }
      }
    };
    expect(getDeclaredTeeTypes(manifest)).toEqual(["cpu", "cpu-gpu"]);
  });

  it("dedupes when several services declare the same type", () => {
    const manifest = {
      services: {
        a: { params: { tee: "cpu" } },
        b: { params: { tee: "cpu" } }
      }
    };
    expect(getDeclaredTeeTypes(manifest)).toEqual(["cpu"]);
  });

  it("ignores services without a tee param and unknown tee values", () => {
    const manifest = {
      services: {
        plain: { image: "nginx" },
        bogus: { params: { tee: "quantum" } },
        valid: { params: { tee: "cpu" } }
      }
    };
    expect(getDeclaredTeeTypes(manifest)).toEqual(["cpu"]);
  });

  it("returns an empty array for malformed manifests instead of throwing", () => {
    expect(getDeclaredTeeTypes({ services: "not-an-object" })).toEqual([]);
    expect(getDeclaredTeeTypes("just a string")).toEqual([]);
    expect(getDeclaredTeeTypes(42)).toEqual([]);
  });
});

describe(getServiceTeeType.name, () => {
  const manifest = {
    services: {
      web: { params: { tee: "cpu-gpu" } },
      api: { image: "nginx" }
    }
  };

  it("returns the declared type for a TEE service", () => {
    expect(getServiceTeeType(manifest, "web")).toBe("cpu-gpu");
  });

  it("returns undefined for a service without a tee param", () => {
    expect(getServiceTeeType(manifest, "api")).toBeUndefined();
  });

  it("returns undefined for an unknown service", () => {
    expect(getServiceTeeType(manifest, "missing")).toBeUndefined();
  });

  it("returns undefined for malformed manifests", () => {
    expect(getServiceTeeType(null, "web")).toBeUndefined();
  });
});

describe(getServiceComputeResources.name, () => {
  it("parses fractional cpu cores and mebibyte memory", () => {
    const manifest = {
      services: { web: { params: { tee: "cpu" } } },
      profiles: { compute: { web: { resources: { cpu: { units: 0.5 }, memory: { size: "256Mi" } } } } }
    };
    expect(getServiceComputeResources(manifest, "web")).toEqual({ cpuMillicores: 500, memoryBytes: 256 * MIB });
  });

  it("parses millicore string cpu units", () => {
    const manifest = {
      profiles: { compute: { web: { resources: { cpu: { units: "500m" }, memory: { size: "1Gi" } } } } }
    };
    expect(getServiceComputeResources(manifest, "web")).toEqual({ cpuMillicores: 500, memoryBytes: GIB });
  });

  it("parses whole-core string and number cpu units", () => {
    const stringManifest = {
      profiles: { compute: { web: { resources: { cpu: { units: "0.5" }, memory: { size: "256Mi" } } } } }
    };
    expect(getServiceComputeResources(stringManifest, "web")?.cpuMillicores).toBe(500);

    const intManifest = {
      profiles: { compute: { web: { resources: { cpu: { units: 1 }, memory: { size: "256Mi" } } } } }
    };
    expect(getServiceComputeResources(intManifest, "web")?.cpuMillicores).toBe(1000);
  });

  it("parses a numeric (suffix-less) memory size as bytes", () => {
    const manifest = {
      profiles: { compute: { web: { resources: { cpu: { units: 1 }, memory: { size: 268435456 } } } } }
    };
    expect(getServiceComputeResources(manifest, "web")).toEqual({ cpuMillicores: 1000, memoryBytes: 268435456 });
  });

  it("returns undefined when the compute profile or resources are missing", () => {
    expect(getServiceComputeResources({ profiles: { compute: {} } }, "web")).toBeUndefined();
    expect(getServiceComputeResources(null, "web")).toBeUndefined();
  });

  it("returns undefined when the cpu units cannot be parsed", () => {
    const manifest = {
      profiles: { compute: { web: { resources: { cpu: { units: {} }, memory: { size: "256Mi" } } } } }
    };
    expect(getServiceComputeResources(manifest, "web")).toBeUndefined();
  });

  it("returns undefined when the memory size is unparseable or of an unexpected type", () => {
    const garbage = {
      profiles: { compute: { web: { resources: { cpu: { units: 1 }, memory: { size: "garbage" } } } } }
    };
    expect(getServiceComputeResources(garbage, "web")).toBeUndefined();

    const objectSize = {
      profiles: { compute: { web: { resources: { cpu: { units: 1 }, memory: { size: {} } } } } }
    };
    expect(getServiceComputeResources(objectSize, "web")).toBeUndefined();
  });
});

describe(computeSidecarCarveout.name, () => {
  it("reserves 100m CPU / 64Mi for the cpu TEE type and leaves the remainder to the container", () => {
    const result = computeSidecarCarveout({ cpuMillicores: 500, memoryBytes: 256 * MIB, teeType: "cpu" });
    expect(result).toEqual({
      reserved: { cpu: 100, memory: 64 * MIB },
      container: { cpu: 400, memory: 192 * MIB }
    });
  });

  it("reserves 128Mi memory for the cpu-gpu TEE type", () => {
    const result = computeSidecarCarveout({ cpuMillicores: 500, memoryBytes: 256 * MIB, teeType: "cpu-gpu" });
    expect(result).toEqual({
      reserved: { cpu: 100, memory: 128 * MIB },
      container: { cpu: 400, memory: 128 * MIB }
    });
  });

  it("floors the container CPU at the minimum when the declared CPU is below the reservation", () => {
    const result = computeSidecarCarveout({ cpuMillicores: 50, memoryBytes: 256 * MIB, teeType: "cpu" });
    expect(result.reserved.cpu).toBe(SIDECAR_CPU_LIMIT_MILLICORES);
    expect(result.container.cpu).toBe(MIN_PRIMARY_CPU_MILLICORES);
  });

  it("floors the container memory at the minimum when the declared memory is below the reservation", () => {
    const result = computeSidecarCarveout({ cpuMillicores: 500, memoryBytes: 32 * MIB, teeType: "cpu" });
    expect(result.reserved.memory).toBe(SIDECAR_MEMORY_LIMIT_BYTES.cpu);
    expect(result.container.memory).toBe(MIN_PRIMARY_MEMORY_BYTES);
  });

  it("subtracts the reservation cleanly for large declarations", () => {
    const result = computeSidecarCarveout({ cpuMillicores: 4000, memoryBytes: GIB, teeType: "cpu" });
    expect(result.container).toEqual({ cpu: 3900, memory: GIB - 64 * MIB });
  });
});

describe(getTeeServiceCarveouts.name, () => {
  it("returns a carve-out for each TEE service with resolvable resources", () => {
    const manifest = {
      services: { web: { params: { tee: "cpu" } } },
      profiles: { compute: { web: { resources: { cpu: { units: 0.5 }, memory: { size: "256Mi" } } } } }
    };

    expect(getTeeServiceCarveouts(manifest)).toEqual([
      {
        serviceName: "web",
        teeType: "cpu",
        requested: { cpu: 500, memory: 256 * MIB },
        reserved: { cpu: 100, memory: 64 * MIB },
        container: { cpu: 400, memory: 192 * MIB }
      }
    ]);
  });

  it("returns an empty array when no service declares a TEE type", () => {
    const manifest = {
      services: { web: { image: "nginx" } },
      profiles: { compute: { web: { resources: { cpu: { units: 1 }, memory: { size: "1Gi" } } } } }
    };
    expect(getTeeServiceCarveouts(manifest)).toEqual([]);
  });

  it("skips TEE services whose compute resources cannot be resolved", () => {
    const manifest = {
      services: { web: { params: { tee: "cpu" } } },
      profiles: { compute: {} }
    };
    expect(getTeeServiceCarveouts(manifest)).toEqual([]);
  });

  it("returns carve-outs sorted by service name for mixed deployments", () => {
    const manifest = {
      services: {
        zeta: { params: { tee: "cpu-gpu" } },
        alpha: { params: { tee: "cpu" } }
      },
      profiles: {
        compute: {
          zeta: { resources: { cpu: { units: 1 }, memory: { size: "512Mi" } } },
          alpha: { resources: { cpu: { units: 1 }, memory: { size: "512Mi" } } }
        }
      }
    };

    const result = getTeeServiceCarveouts(manifest);
    expect(result.map(c => c.serviceName)).toEqual(["alpha", "zeta"]);
    expect(result[1].reserved.memory).toBe(128 * MIB);
  });

  it("returns an empty array for malformed manifests", () => {
    expect(getTeeServiceCarveouts(null)).toEqual([]);
  });
});

describe(omitAttestationSidecar.name, () => {
  it("returns the same reference when no attestation sidecar is present", () => {
    const leaseStatus = {
      services: { web: { name: "web" } },
      forwarded_ports: { web: [] },
      ips: {}
    };
    expect(omitAttestationSidecar(leaseStatus)).toBe(leaseStatus);
  });

  it("strips the attestation sidecar from services, forwarded_ports and ips when present", () => {
    const leaseStatus = {
      services: { web: { name: "web" }, "akash-attestation-sidecar": { name: "akash-attestation-sidecar" } },
      forwarded_ports: { web: [], "akash-attestation-sidecar": [] },
      ips: { "akash-attestation-sidecar": [] }
    };

    const result = omitAttestationSidecar(leaseStatus);

    expect(result.services).toEqual({ web: { name: "web" } });
    expect(result.forwarded_ports).toEqual({ web: [] });
    expect(result.ips).toEqual({});
    expect(result).not.toBe(leaseStatus);
  });

  it("does not throw when forwarded_ports or ips are absent", () => {
    const leaseStatus = { services: { "akash-attestation-sidecar": { name: "akash-attestation-sidecar" } } };
    expect(omitAttestationSidecar(leaseStatus).services).toEqual({});
  });

  it("strips an attestation sidecar entry even when its value is falsy", () => {
    const leaseStatus = { services: { web: { name: "web" }, "akash-attestation-sidecar": null } };
    const result = omitAttestationSidecar(leaseStatus);
    expect(result.services).toEqual({ web: { name: "web" } });
    expect(result).not.toBe(leaseStatus);
  });
});

describe(getDeclaredTeeTypesFromYaml.name, () => {
  it("parses a manifest YAML string and returns its declared TEE types", () => {
    const manifestYaml = ["services:", "  web:", "    params:", "      tee: cpu-gpu"].join("\n");
    expect(getDeclaredTeeTypesFromYaml(manifestYaml)).toEqual(["cpu-gpu"]);
  });

  it("returns an empty array for empty or nullish input", () => {
    expect(getDeclaredTeeTypesFromYaml("")).toEqual([]);
    expect(getDeclaredTeeTypesFromYaml(null)).toEqual([]);
    expect(getDeclaredTeeTypesFromYaml(undefined)).toEqual([]);
  });

  it("returns an empty array for malformed YAML instead of throwing", () => {
    expect(getDeclaredTeeTypesFromYaml("services: [unclosed")).toEqual([]);
  });
});

describe(formatTeeTypeLabel.name, () => {
  it("renders friendly labels for each TEE type", () => {
    expect(formatTeeTypeLabel("cpu")).toBe("CPU");
    expect(formatTeeTypeLabel("cpu-gpu")).toBe("CPU + GPU");
  });
});
