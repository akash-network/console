import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServiceType } from "@src/types";
import type { DeploymentResourceTotals } from "./deploymentResources";
import { aggregateDeploymentResources, deploymentResourceSegments } from "./deploymentResources";

const MI = 1024 ** 2;
const GI = 1024 ** 3;

describe(aggregateDeploymentResources.name, () => {
  it("aggregates a single default service (cpu 0.1, 512 Mi ram, 1 Gi ephemeral)", () => {
    const { services } = setup({ services: [{ cpu: 0.1, ram: 512, ramUnit: "Mi", storage: [{ size: 1, unit: "Gi" }] }] });

    expect(aggregateDeploymentResources(services)).toEqual({
      cpu: 0.1,
      gpu: 0,
      memoryBytes: 512 * MI,
      ephemeralBytes: 1 * GI,
      persistentBytes: 0
    });
  });

  it("multiplies every resource by the service replica count", () => {
    const { services } = setup({ services: [{ cpu: 0.5, ram: 1, ramUnit: "Gi", storage: [{ size: 2, unit: "Gi" }], count: 3 }] });

    expect(aggregateDeploymentResources(services)).toEqual({
      cpu: 1.5,
      gpu: 0,
      memoryBytes: 3 * GI,
      ephemeralBytes: 6 * GI,
      persistentBytes: 0
    });
  });

  it("sums resources across multiple services with mixed units", () => {
    const { services } = setup({
      services: [
        { cpu: 1, ram: 512, ramUnit: "Mi", storage: [{ size: 1, unit: "Gi" }] },
        { cpu: 2, ram: 1, ramUnit: "Gi", storage: [{ size: 1024, unit: "Mi" }] }
      ]
    });

    const totals = aggregateDeploymentResources(services);

    expect(totals.cpu).toBe(3);
    expect(totals.memoryBytes).toBe(512 * MI + 1 * GI);
    expect(totals.ephemeralBytes).toBe(1 * GI + 1024 * MI);
  });

  it("counts gpu only when hasGpu is set", () => {
    const { services } = setup({
      services: [
        { cpu: 1, hasGpu: true, gpu: 2, count: 2 },
        { cpu: 1, hasGpu: false, gpu: 4 }
      ]
    });

    expect(aggregateDeploymentResources(services).gpu).toBe(4);
  });

  it("splits storage into ephemeral and persistent by isPersistent", () => {
    const { services } = setup({
      services: [
        {
          cpu: 1,
          storage: [
            { size: 1, unit: "Gi" },
            { size: 10, unit: "Gi", isPersistent: true }
          ]
        }
      ]
    });

    const totals = aggregateDeploymentResources(services);

    expect(totals.ephemeralBytes).toBe(1 * GI);
    expect(totals.persistentBytes).toBe(10 * GI);
  });

  function setup(input: {
    services: Array<{
      cpu?: number;
      ram?: number;
      ramUnit?: string;
      hasGpu?: boolean;
      gpu?: number;
      count?: number;
      storage?: Array<{ size: number; unit: string; isPersistent?: boolean }>;
    }>;
  }) {
    const services = input.services.map(s =>
      mock<ServiceType>({
        count: s.count ?? 1,
        profile: {
          cpu: s.cpu ?? 0,
          hasGpu: s.hasGpu ?? false,
          gpu: s.gpu ?? 0,
          ram: s.ram ?? 0,
          ramUnit: s.ramUnit ?? "Mi",
          storage: (s.storage ?? [{ size: 0, unit: "Gi" }]).map(st => ({
            size: st.size,
            unit: st.unit,
            isPersistent: st.isPersistent ?? false
          }))
        }
      })
    );
    return { services };
  }
});

describe(deploymentResourceSegments.name, () => {
  it("labels cpu, memory and ephemeral storage in binary units with a space before the unit", () => {
    expect(deploymentResourceSegments(setup({ cpu: 0.1, memoryBytes: 512 * MI, ephemeralBytes: 1 * GI }))).toEqual([
      { kind: "cpu", label: "0.1 vCPU" },
      { kind: "memory", label: "512 MiB" },
      { kind: "storage", label: "1 GiB" }
    ]);
  });

  it("puts the gpu segment right after cpu when gpu is present", () => {
    expect(deploymentResourceSegments(setup({ cpu: 2, gpu: 1, memoryBytes: 8 * GI, ephemeralBytes: 100 * GI })).map(segment => segment.label)).toEqual([
      "2 vCPU",
      "1 GPU",
      "8 GiB",
      "100 GiB"
    ]);
  });

  it("appends a labeled persistent segment when persistent storage is present", () => {
    expect(deploymentResourceSegments(setup({ cpu: 1, memoryBytes: 1 * GI, ephemeralBytes: 1 * GI, persistentBytes: 10 * GI })).at(-1)).toEqual({
      kind: "persistent",
      label: "10 GiB persistent"
    });
  });

  it("rounds fractional values to two decimals", () => {
    expect(deploymentResourceSegments(setup({ cpu: 1.005, memoryBytes: 1536 * MI, ephemeralBytes: 1 * GI })).map(segment => segment.label)).toEqual([
      "1.01 vCPU",
      "1.5 GiB",
      "1 GiB"
    ]);
  });

  it("returns no segments when the spec has no resources", () => {
    expect(deploymentResourceSegments(setup({}))).toEqual([]);
  });

  it.each([
    ["cpu", { cpu: 1 }],
    ["gpu", { gpu: 1 }],
    ["memory", { memoryBytes: 1 * GI }],
    ["ephemeral storage", { ephemeralBytes: 1 * GI }],
    ["persistent storage", { persistentBytes: 1 * GI }]
  ])("returns segments for a spec that only has %s", (_, totals) => {
    expect(deploymentResourceSegments(setup(totals)).length).toBeGreaterThan(0);
  });

  function setup(input: Partial<DeploymentResourceTotals>) {
    return { cpu: 0, gpu: 0, memoryBytes: 0, ephemeralBytes: 0, persistentBytes: 0, ...input };
  }
});
