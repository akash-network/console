import type { QueryInput as DeepPartial } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import type { DeploymentGroup } from "@src/types/deployment";
import {
  computeSidecarCarveout,
  formatTeeTypeLabel,
  getDeclaredTeeTypes,
  getGroupTeeType,
  getTeeResourceCarveouts,
  MIN_PRIMARY_CPU_MILLICORES,
  MIN_PRIMARY_MEMORY_BYTES,
  omitAttestationSidecar,
  SIDECAR_CPU_LIMIT_MILLICORES,
  SIDECAR_MEMORY_LIMIT_BYTES,
  type TeeType
} from "./confidentialCompute";

import { buildRpcDeployment } from "@tests/seeders";

const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

/** Builds a single on-chain deployment group, seeded with realistic defaults and the given overrides. */
function buildGroup(spec?: DeepPartial<DeploymentGroup>): DeploymentGroup {
  return buildRpcDeployment(spec ? { groups: [spec] } : undefined).groups[0];
}

/** Builds a complete on-chain resource unit (the entries of group_spec.resources). */
function buildResourceUnit(input: { id: number; cpuMillicores: number; memoryBytes: number; gpuUnits?: number; count?: number }) {
  return {
    resource: {
      id: input.id,
      cpu: { units: { val: String(input.cpuMillicores) }, attributes: [] },
      memory: { quantity: { val: String(input.memoryBytes) }, attributes: [] },
      storage: [{ name: "default", quantity: { val: String(512 * MIB) }, attributes: [] }],
      gpu: { units: { val: String(input.gpuUnits ?? 0) }, attributes: [] },
      endpoints: []
    },
    count: input.count ?? 1,
    price: { denom: "uakt", amount: "10000" }
  };
}

const teeRequirement = (teeType: TeeType) => ({ requirements: { attributes: [{ key: "tee/type", value: teeType }] } });

describe(getGroupTeeType.name, () => {
  it("returns the TEE type declared on the group's placement requirements", () => {
    expect(getGroupTeeType(buildGroup({ group_spec: teeRequirement("cpu") }))).toBe("cpu");
    expect(getGroupTeeType(buildGroup({ group_spec: teeRequirement("cpu-gpu") }))).toBe("cpu-gpu");
  });

  it("ignores other placement attributes and reads only tee/type", () => {
    const group = buildGroup({
      group_spec: {
        requirements: {
          attributes: [
            { key: "region", value: "us-west" },
            { key: "tee/type", value: "cpu-gpu" }
          ]
        }
      }
    });
    expect(getGroupTeeType(group)).toBe("cpu-gpu");
  });

  it("returns undefined when no tee/type attribute is present", () => {
    expect(getGroupTeeType(buildGroup({ group_spec: { requirements: { attributes: [{ key: "region", value: "us-west" }] } } }))).toBeUndefined();
    expect(getGroupTeeType(buildGroup())).toBeUndefined();
  });

  it("returns undefined for an unrecognized tee/type value", () => {
    expect(getGroupTeeType(buildGroup({ group_spec: { requirements: { attributes: [{ key: "tee/type", value: "sgx" }] } } }))).toBeUndefined();
  });

  it("returns undefined for a nullish or malformed group", () => {
    expect(getGroupTeeType(undefined)).toBeUndefined();
    expect(getGroupTeeType(null)).toBeUndefined();
  });
});

describe(getDeclaredTeeTypes.name, () => {
  it("returns an empty array for nullish or empty group lists", () => {
    expect(getDeclaredTeeTypes(undefined)).toEqual([]);
    expect(getDeclaredTeeTypes(null)).toEqual([]);
    expect(getDeclaredTeeTypes([])).toEqual([]);
  });

  it("returns the single declared type for a one-group deployment", () => {
    expect(getDeclaredTeeTypes([buildGroup({ group_spec: teeRequirement("cpu") })])).toEqual(["cpu"]);
    expect(getDeclaredTeeTypes([buildGroup({ group_spec: teeRequirement("cpu-gpu") })])).toEqual(["cpu-gpu"]);
  });

  it("returns the distinct set in canonical order across mixed groups", () => {
    const groups = [buildGroup({ group_spec: teeRequirement("cpu-gpu") }), buildGroup({ group_spec: teeRequirement("cpu") })];
    expect(getDeclaredTeeTypes(groups)).toEqual(["cpu", "cpu-gpu"]);
  });

  it("dedupes when several groups declare the same type", () => {
    const groups = [buildGroup({ group_spec: teeRequirement("cpu") }), buildGroup({ group_spec: teeRequirement("cpu") })];
    expect(getDeclaredTeeTypes(groups)).toEqual(["cpu"]);
  });

  it("ignores groups that declare no TEE type", () => {
    const groups = [buildGroup({ group_spec: teeRequirement("cpu") }), buildGroup()];
    expect(getDeclaredTeeTypes(groups)).toEqual(["cpu"]);
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

describe(getTeeResourceCarveouts.name, () => {
  it("returns a per-pod carve-out for each resource unit in a TEE group", () => {
    const group = buildGroup({
      group_spec: {
        requirements: { attributes: [{ key: "tee/type", value: "cpu" }] },
        resources: [buildResourceUnit({ id: 1, cpuMillicores: 500, memoryBytes: 256 * MIB })]
      }
    });

    expect(getTeeResourceCarveouts(group)).toEqual([
      {
        id: "1",
        teeType: "cpu",
        count: 1,
        gpuUnits: 0,
        requested: { cpu: 500, memory: 256 * MIB },
        reserved: { cpu: 100, memory: 64 * MIB },
        container: { cpu: 400, memory: 192 * MIB }
      }
    ]);
  });

  it("returns an empty array when the group declares no TEE type", () => {
    const group = buildGroup({ group_spec: { resources: [buildResourceUnit({ id: 1, cpuMillicores: 1000, memoryBytes: GIB })] } });
    expect(getTeeResourceCarveouts(group)).toEqual([]);
  });

  it("uses the group's TEE type for every resource unit and carries replica count and gpu units", () => {
    const group = buildGroup({
      group_spec: {
        requirements: { attributes: [{ key: "tee/type", value: "cpu-gpu" }] },
        resources: [
          buildResourceUnit({ id: 1, cpuMillicores: 500, memoryBytes: 256 * MIB }),
          buildResourceUnit({ id: 2, cpuMillicores: 8000, memoryBytes: 32 * GIB, gpuUnits: 1, count: 2 })
        ]
      }
    });

    expect(getTeeResourceCarveouts(group)).toEqual([
      {
        id: "1",
        teeType: "cpu-gpu",
        count: 1,
        gpuUnits: 0,
        requested: { cpu: 500, memory: 256 * MIB },
        reserved: { cpu: 100, memory: 128 * MIB },
        container: { cpu: 400, memory: 128 * MIB }
      },
      {
        id: "2",
        teeType: "cpu-gpu",
        count: 2,
        gpuUnits: 1,
        requested: { cpu: 8000, memory: 32 * GIB },
        reserved: { cpu: 100, memory: 128 * MIB },
        container: { cpu: 7900, memory: 32 * GIB - 128 * MIB }
      }
    ]);
  });

  it("skips resource units whose on-chain cpu or memory cannot be parsed", () => {
    const group = buildGroup({
      group_spec: {
        requirements: { attributes: [{ key: "tee/type", value: "cpu" }] },
        resources: [
          {
            ...buildResourceUnit({ id: 1, cpuMillicores: 0, memoryBytes: 0 }),
            resource: { ...buildResourceUnit({ id: 1, cpuMillicores: 0, memoryBytes: 0 }).resource, cpu: { units: { val: "not-a-number" }, attributes: [] } }
          },
          buildResourceUnit({ id: 2, cpuMillicores: 1000, memoryBytes: GIB })
        ]
      }
    });

    expect(getTeeResourceCarveouts(group).map(c => c.id)).toEqual(["2"]);
  });

  it("skips resource units whose on-chain cpu is a suffixed (non-integer) string", () => {
    const group = buildGroup({
      group_spec: {
        requirements: { attributes: [{ key: "tee/type", value: "cpu" }] },
        resources: [
          {
            ...buildResourceUnit({ id: 1, cpuMillicores: 500, memoryBytes: 256 * MIB }),
            resource: { ...buildResourceUnit({ id: 1, cpuMillicores: 500, memoryBytes: 256 * MIB }).resource, cpu: { units: { val: "500Mi" }, attributes: [] } }
          },
          buildResourceUnit({ id: 2, cpuMillicores: 1000, memoryBytes: GIB })
        ]
      }
    });

    expect(getTeeResourceCarveouts(group).map(c => c.id)).toEqual(["2"]);
  });

  it("returns an empty array for a nullish group", () => {
    expect(getTeeResourceCarveouts(undefined)).toEqual([]);
    expect(getTeeResourceCarveouts(null)).toEqual([]);
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

describe(formatTeeTypeLabel.name, () => {
  it("renders friendly labels for each TEE type", () => {
    expect(formatTeeTypeLabel("cpu")).toBe("CPU");
    expect(formatTeeTypeLabel("cpu-gpu")).toBe("CPU + GPU");
  });
});
