import type { ProviderSnapshotNode, ProviderSnapshotNodeCPU } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import {
  cleanCpuModelName,
  countNodesWithoutCpuModel,
  describeCpu,
  describeProviderCpus,
  getCpuProfile,
  getProviderCpuModels,
  normalizeCpuVendor,
  parseBaseFrequencyMhz,
  recognizeCpuGeneration
} from "./cpu-model";

describe(normalizeCpuVendor.name, () => {
  it.each([
    ["GenuineIntel", "Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz", "Intel"],
    ["AuthenticAMD", "AMD EPYC 7763 64-Core Processor", "AMD"],
    ["", "AMD Ryzen 9 7950X 16-Core Processor", "AMD"],
    [null, "Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz", "Intel"],
    ["AuthenticAMD", "QEMU Virtual CPU version 2.5+", "AMD"]
  ])("reads vendor %j with model %j as %s", (vendor, model, expected) => {
    expect(normalizeCpuVendor(vendor, model)).toBe(expected);
  });

  it.each([
    ["HygonGenuine", "Hygon C86 7185 32-core Processor"],
    ["ARM", ""],
    [null, null],
    [undefined, undefined]
  ])("returns null for vendor %j with model %j", (vendor, model) => {
    expect(normalizeCpuVendor(vendor, model)).toBeNull();
  });
});

describe(parseBaseFrequencyMhz.name, () => {
  it.each([
    ["Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz", 3000],
    ["Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz", 2600],
    ["Intel(R) Xeon(R) CPU @ 2.25GHz", 2250],
    ["Intel(R) Pentium(R) III CPU @ 800MHz", 800],
    ["Intel(R) Atom(TM) CPU @1.66ghz", 1660]
  ])("reads %j as %d MHz", (model, expected) => {
    expect(parseBaseFrequencyMhz(model)).toBe(expected);
  });

  it.each(["AMD EPYC 7763 64-Core Processor", "13th Gen Intel(R) Core(TM) i9-13900K", "Xeon 3GHz"])("returns null when %j names no base frequency", model => {
    expect(parseBaseFrequencyMhz(model)).toBeNull();
  });
});

describe(cleanCpuModelName.name, () => {
  it.each([
    ["Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz", "Xeon Gold 6248R"],
    ["Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz", "Xeon E5-2690 v4"],
    ["Intel(R) Xeon(R) CPU @ 2.30GHz", "Xeon"],
    ["13th Gen Intel(R) Core(TM) i9-13900K", "Core i9-13900K"],
    ["2nd Gen Intel(R) Core(TM) i7-2600 CPU @ 3.40GHz", "Core i7-2600"],
    ["AMD EPYC 7763 64-Core Processor", "EPYC 7763"],
    ["AMD Ryzen 9 7950X 16-Core Processor", "Ryzen 9 7950X"],
    ["AMD Ryzen 7 5700G with Radeon Graphics", "Ryzen 7 5700G"],
    ["Intel(R)Xeon(R)Gold 6248R", "Xeon Gold 6248R"],
    ["AMD Ryzen 7 7840U w/ Radeon  780M Graphics", "Ryzen 7 7840U"],
    ["AMD Ryzen Threadripper PRO 3975WX 32-Cores", "Ryzen Threadripper PRO 3975WX"],
    ["AMD EPYC Processor (with IBPB)", "EPYC"],
    ["  AMD   EPYC 9654  96-Core   Processor ", "EPYC 9654"],
    ["Cortex-A72, rev 3", "Cortex-A72 rev 3"]
  ])("cleans %j to %j", (model, expected) => {
    expect(cleanCpuModelName(model)).toBe(expected);
  });
});

describe(recognizeCpuGeneration.name, () => {
  it.each([
    ["EPYC 7551", "Naples"],
    ["EPYC 7742", "Rome"],
    ["EPYC 7763", "Milan"],
    ["EPYC 7773X", "Milan"],
    ["EPYC 8534P", "Siena"],
    ["EPYC 9654", "Genoa"],
    ["EPYC 9754", "Bergamo"],
    ["EPYC 9965", "Turin"],
    ["EPYC 9755", "Turin"],
    ["Xeon Gold 6148", "Skylake"],
    ["Xeon Gold 6248R", "Cascade Lake"],
    ["Xeon Silver 4314", "Ice Lake"],
    ["Xeon Gold 6328H", "Cooper Lake"],
    ["Xeon Platinum 8380HL", "Cooper Lake"],
    ["Xeon Platinum 8480C", "Sapphire Rapids"],
    ["Xeon Platinum 8592", "Emerald Rapids"],
    ["Xeon Platinum 8490H", "Sapphire Rapids"],
    ["Xeon Platinum 8462Y+", "Sapphire Rapids"],
    ["Xeon 6776P", "Granite Rapids"],
    ["Xeon 6530P", "Granite Rapids"],
    ["Xeon 6980P", "Granite Rapids"],
    ["Xeon 6780E", "Sierra Forest"],
    ["Xeon 6960E", "Sierra Forest"],
    ["Xeon Bronze 3204", "Cascade Lake"],
    ["Xeon E5-2670", "Sandy Bridge"],
    ["Xeon E5-2697 v2", "Ivy Bridge"],
    ["Xeon E5-2680 v3", "Haswell"],
    ["Xeon E5-2690 v4", "Broadwell"],
    ["Xeon E3-1270 v6", "Kaby Lake"],
    ["Xeon E3-1230L v5", "Skylake"],
    ["Core i7-2600", "2nd Gen"],
    ["Core i5-3570K", "3rd Gen"],
    ["Core i7-8700", "8th Gen"],
    ["Core i9-9900K", "9th Gen"],
    ["Core i7-1065G7", "10th Gen"],
    ["Core i5-10400", "10th Gen"],
    ["Core i9-13900K", "13th Gen"],
    ["Core i9-13980HX", "13th Gen"],
    ["Ryzen 7 2700X", "Zen+"],
    ["Ryzen 9 3900X", "Zen 2"],
    ["Ryzen 9 PRO 3900", "Zen 2"],
    ["Ryzen 9 5950X", "Zen 3"],
    ["Ryzen 7 5800X3D", "Zen 3"],
    ["Ryzen 5 5600XT", "Zen 3"],
    ["Ryzen 9 7950X", "Zen 4"],
    ["Ryzen 9 9950X", "Zen 5"]
  ])("recognizes %j as %s", (model, expected) => {
    expect(recognizeCpuGeneration(model)).toBe(expected);
  });

  it.each([
    "Xeon",
    "EPYC",
    "EPYC 7B13",
    "EPYC 7R32",
    "EPYC 3251",
    "EPYC 7766",
    "EPYC 76543",
    "My EPYC 7763",
    "EPYC 7763 Engineering Sample",
    "Dual Xeon Gold 6148",
    "Xeon Gold 6948",
    "Xeon Gold 61480",
    "Xeon W-2295",
    "Xeon 6776",
    "Old Xeon 6776P",
    "Xeon 6776P Engineering Sample",
    "EPYC 7774",
    "Xeon 67760P",
    "Xeon 6369P",
    "Xeon 6530E",
    "Xeon 6880P",
    "Xeon E-2288G",
    "Xeon D-1541",
    "Xeon E5-2690 v7",
    "Xeon E7-8890 v4",
    "Old Xeon E5-2690 v4",
    "Xeon E5-2690 v4 Engineering Sample",
    "Core i7-920",
    "Core i9-7900X",
    "Core i7-6950X",
    "Core i9-10980XE",
    "Core i7-8700 Engineering Sample",
    "Core Ultra 9 285K",
    "Mobile Core i7-8700",
    "Ryzen 5 1600",
    "Ryzen 5 4500",
    "Ryzen 7 5700G",
    "Ryzen 7 5700U",
    "Ryzen 5 7500F",
    "Ryzen 9 59500X",
    "AMD Ryzen 9 5950X",
    "Ryzen Threadripper 3970X",
    "Neoverse-N1",
    ""
  ])("does not guess a generation for %j", model => {
    expect(recognizeCpuGeneration(model)).toBeNull();
  });
});

describe(describeCpu.name, () => {
  it("describes a physical CPU by vendor, clean model, generation and base frequency", () => {
    expect(describeCpu("GenuineIntel", "Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz")).toEqual({
      vendor: "Intel",
      model: "Xeon Gold 6248R",
      generation: "Cascade Lake",
      baseFrequencyMhz: 3000,
      isVirtual: false
    });
  });

  it("leaves generation and base frequency null when the name carries neither", () => {
    expect(describeCpu("AuthenticAMD", "AMD EPYC 7B13")).toEqual({
      vendor: "AMD",
      model: "EPYC 7B13",
      generation: null,
      baseFrequencyMhz: null,
      isVirtual: false
    });
  });

  it.each([
    ["QEMU Virtual CPU version 2.5+", "QEMU Virtual version 2.5+"],
    ["Common KVM processor", "Common KVM"],
    ["Intel Xeon Processor (Icelake)", "Xeon"],
    ["Intel Core Processor (Broadwell, IBRS)", "Core"],
    ["AMD EPYC-Milan Processor", "EPYC-Milan"],
    ["AMD EPYC Processor (with IBPB)", "EPYC"],
    ["AMD EPYC Processor", "EPYC"],
    ["Intel Xeon E312xx (Sandy Bridge)", "Xeon E312xx"],
    ["AMD Opteron 63xx class CPU", "Opteron 63xx class"],
    ["Intel Core i7 9xx (Nehalem Class Core i7)", "Core i7 9xx"]
  ])("marks the hypervisor name %j as virtual without a generation", (model, cleanModel) => {
    expect(describeCpu("GenuineIntel", model)).toMatchObject({ model: cleanModel, generation: null, isVirtual: true });
  });

  it.each([
    ["GenuineIntel", "QEMU Virtual CPU version 2.5+", null],
    ["AuthenticAMD", "Common KVM processor", null],
    ["GenuineIntel", "AMD EPYC-Milan Processor", "AMD"],
    ["AuthenticAMD", "Intel Xeon Processor (Icelake)", "Intel"]
  ])("takes the vendor of a virtual CPU reported as %j %j from its name only, as %j", (vendor, model, expected) => {
    expect(describeCpu(vendor, model)?.vendor).toBe(expected);
  });

  it("does not call a cloud CPU virtual when its name does not say so", () => {
    expect(describeCpu("GenuineIntel", "Intel(R) Xeon(R) CPU @ 2.30GHz")).toMatchObject({ model: "Xeon", isVirtual: false, baseFrequencyMhz: 2300 });
  });

  it("keeps the reported name when cleaning leaves nothing", () => {
    expect(describeCpu("GenuineIntel", "Intel(R) CPU")).toMatchObject({ model: "Intel(R) CPU", vendor: "Intel" });
  });

  it("keeps a CPU from another vendor with a null vendor", () => {
    expect(describeCpu("HygonGenuine", " Hygon C86 7285 32-core Processor ")).toEqual({
      vendor: null,
      model: "Hygon C86 7285",
      generation: null,
      baseFrequencyMhz: null,
      isVirtual: false
    });
  });

  it("returns null for an ARM node, which reports a vendor but no model name", () => {
    expect(describeCpu("ARM", "")).toBeNull();
  });

  it.each([null, undefined, "", "   "])("returns null for the model %j", model => {
    expect(describeCpu("GenuineIntel", model)).toBeNull();
  });
});

describe(getProviderCpuModels.name, () => {
  it("sums threads and counts nodes per CPU model", () => {
    const epyc = { vendor: "AuthenticAMD", model: "AMD EPYC 7763 64-Core Processor", vcores: 128 };
    const xeon = { vendor: "GenuineIntel", model: "Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz", vcores: 96 };

    expect(getProviderCpuModels([buildNode([epyc]), buildNode([epyc]), buildNode([xeon])])).toEqual([
      { vendor: "AMD", model: "EPYC 7763", generation: "Milan", baseFrequencyMhz: null, isVirtual: false, threads: 256, nodeCount: 2 },
      { vendor: "Intel", model: "Xeon Gold 6248R", generation: "Cascade Lake", baseFrequencyMhz: 3000, isVirtual: false, threads: 96, nodeCount: 1 }
    ]);
  });

  it("counts a node once when it reports the same model on several sockets", () => {
    const socket = { vendor: "GenuineIntel", model: "Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz", vcores: 28 };

    expect(getProviderCpuModels([buildNode([socket, socket])])).toMatchObject([{ model: "Xeon E5-2690 v4", threads: 56, nodeCount: 1 }]);
  });

  it("counts a node under each model it runs", () => {
    const node = buildNode([
      { vendor: "AuthenticAMD", model: "AMD EPYC 7763 64-Core Processor", vcores: 128 },
      { vendor: "AuthenticAMD", model: "AMD EPYC 9654 96-Core Processor", vcores: 192 }
    ]);

    expect(getProviderCpuModels([node])).toMatchObject([
      { model: "EPYC 9654", threads: 192, nodeCount: 1 },
      { model: "EPYC 7763", threads: 128, nodeCount: 1 }
    ]);
  });

  it("keeps the same model at two base frequencies apart", () => {
    const models = getProviderCpuModels([
      buildNode([{ vendor: "GenuineIntel", model: "Intel(R) Xeon(R) CPU @ 2.30GHz", vcores: 8 }]),
      buildNode([{ vendor: "GenuineIntel", model: "Intel(R) Xeon(R) CPU @ 2.20GHz", vcores: 8 }])
    ]);

    expect(models.map(cpuModel => cpuModel.baseFrequencyMhz).sort()).toEqual([2200, 2300]);
  });

  it("orders models with equal threads by name", () => {
    const models = getProviderCpuModels([
      buildNode([{ vendor: "AuthenticAMD", model: "AMD Ryzen 9 7950X 16-Core Processor", vcores: 32 }]),
      buildNode([{ vendor: "AuthenticAMD", model: "AMD Ryzen 9 5950X 16-Core Processor", vcores: 32 }])
    ]);

    expect(models.map(cpuModel => cpuModel.model)).toEqual(["Ryzen 9 5950X", "Ryzen 9 7950X"]);
  });

  it("skips CPUs that report no model and counts missing threads as zero", () => {
    const models = getProviderCpuModels([
      buildNode([
        { vendor: "GenuineIntel", model: "", vcores: 4 },
        { vendor: "AuthenticAMD", model: "AMD EPYC 7763 64-Core Processor", vcores: null }
      ])
    ]);

    expect(models).toMatchObject([{ model: "EPYC 7763", threads: 0, nodeCount: 1 }]);
    expect(models).toHaveLength(1);
  });

  it("returns an empty list for nodes loaded without their CPUs", () => {
    expect(getProviderCpuModels([mock<ProviderSnapshotNode>({ cpus: undefined })])).toEqual([]);
  });

  function buildNode(cpus: { vendor: string; model: string; vcores: number | null }[]) {
    return mock<ProviderSnapshotNode>({
      cpus: cpus.map(cpu => mock<ProviderSnapshotNodeCPU>({ ...cpu, vcores: cpu.vcores as number }))
    });
  }
});

describe("virtual and physical CPUs with the same name", () => {
  const physical = { vendor: "GenuineIntel", model: "Intel(R) Xeon(R) CPU", vcores: 8 };
  const virtual = { vendor: "GenuineIntel", model: "Intel Xeon Processor (Icelake)", vcores: 8 };

  it.each([
    ["physical first", [physical, virtual]],
    ["virtual first", [virtual, physical]]
  ])("keeps them apart and reports mixed, %s", (_, cpus) => {
    const result = describeProviderCpus(cpus.map(cpu => mock<ProviderSnapshotNode>({ cpus: [mock<ProviderSnapshotNodeCPU>(cpu)] })));

    expect(result.cpuModels.map(model => model.isVirtual).sort()).toEqual([false, true]);
    expect(result.cpuProfile).toBe("mixed");
  });
});

describe(countNodesWithoutCpuModel.name, () => {
  const epyc = mock<ProviderSnapshotNodeCPU>({ vendor: "AuthenticAMD", model: "AMD EPYC 7763 64-Core Processor", vcores: 128 });
  const blank = mock<ProviderSnapshotNodeCPU>({ vendor: "GenuineIntel", model: "", vcores: 4 });

  it.each([
    ["a readable model", [epyc], 0],
    ["a readable model among blank ones", [blank, epyc], 0],
    ["no CPUs", [], 1],
    ["only a blank model", [blank], 1],
    ["CPUs that were not loaded", undefined, 1]
  ])("counts a node with %s as %j unreported", (_, cpus, expected) => {
    expect(countNodesWithoutCpuModel([mock<ProviderSnapshotNode>({ cpus })])).toBe(expected);
  });
});

describe(describeProviderCpus.name, () => {
  const epyc = { vendor: "AuthenticAMD", model: "AMD EPYC 7763 64-Core Processor", vcores: 128 };

  it("returns the models, the profile and the nodes without a model", () => {
    const nodes = [mock<ProviderSnapshotNode>({ cpus: [mock<ProviderSnapshotNodeCPU>(epyc)] }), mock<ProviderSnapshotNode>({ cpus: [] })];

    expect(describeProviderCpus(nodes)).toEqual({
      cpuModels: [{ vendor: "AMD", model: "EPYC 7763", generation: "Milan", baseFrequencyMhz: null, isVirtual: false, threads: 128, nodeCount: 1 }],
      cpuProfile: "mixed",
      cpuUnreportedNodeCount: 1
    });
  });

  it("counts no node as unreported when none reports a model", () => {
    const nodes = [mock<ProviderSnapshotNode>({ cpus: [] }), mock<ProviderSnapshotNode>({ cpus: [] })];

    expect(describeProviderCpus(nodes)).toEqual({ cpuModels: [], cpuProfile: "unknown", cpuUnreportedNodeCount: 0 });
  });
});

describe(getCpuProfile.name, () => {
  const physical = { isVirtual: false };
  const virtual = { isVirtual: true };

  it.each([
    [[], 0, "unknown"],
    [[], 3, "unknown"],
    [[physical], 1, "mixed"],
    [[virtual], 2, "mixed"],
    [[physical], 0, "uniform"],
    [[physical, physical], 0, "mixed"],
    [[virtual, physical], 0, "mixed"],
    [[virtual, virtual], 0, "virtual"]
  ])("calls %j with %j nodes unreported %s", (models, unreported, expected) => {
    expect(getCpuProfile(models, unreported)).toBe(expected);
  });
});

describe("CPU names reported by 51 mainnet providers on 2026-11-15", () => {
  it.each([
    ["GenuineIntel", "Intel(R) Xeon(R) Platinum 8470", "Intel", "Xeon Platinum 8470", "Sapphire Rapids", null, false],
    ["AuthenticAMD", "AMD EPYC 7763 64-Core Processor", "AMD", "EPYC 7763", "Milan", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Gold 6140 CPU @ 2.30GHz", "Intel", "Xeon Gold 6140", "Skylake", 2300, false],
    ["AuthenticAMD", "AMD EPYC 9335 32-Core Processor", "AMD", "EPYC 9335", "Turin", null, false],
    ["AuthenticAMD", "AMD Ryzen 9 5900X 12-Core Processor", "AMD", "Ryzen 9 5900X", "Zen 3", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2699 v3 @ 2.30GHz", "Intel", "Xeon E5-2699 v3", "Haswell", 2300, false],
    ["AuthenticAMD", "AMD EPYC 7502 32-Core Processor", "AMD", "EPYC 7502", "Rome", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz", "Intel", "Xeon E5-2680 v4", "Broadwell", 2400, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Platinum 8468", "Intel", "Xeon Platinum 8468", "Sapphire Rapids", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Platinum 8168 CPU @ 2.70GHz", "Intel", "Xeon Platinum 8168", "Skylake", 2700, false],
    ["AuthenticAMD", "AMD EPYC 7352 24-Core Processor", "AMD", "EPYC 7352", "Rome", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2698 v3 @ 2.30GHz", "Intel", "Xeon E5-2698 v3", "Haswell", 2300, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Gold 6130 CPU @ 2.10GHz", "Intel", "Xeon Gold 6130", "Skylake", 2100, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Platinum 8173M CPU @ 2.00GHz", "Intel", "Xeon Platinum 8173M", "Skylake", 2000, false],
    ["GenuineIntel", "12th Gen Intel(R) Core(TM) i9-12900HK", "Intel", "Core i9-12900HK", "12th Gen", null, false],
    ["AuthenticAMD", "AMD EPYC 9334 32-Core Processor", "AMD", "EPYC 9334", "Genoa", null, false],
    ["AuthenticAMD", "AMD Ryzen 7 4800U with Radeon Graphics", "AMD", "Ryzen 7 4800U", null, null, false],
    ["GenuineIntel", "Intel(R) Core(TM) i5-8500T CPU @ 2.10GHz", "Intel", "Core i5-8500T", "8th Gen", 2100, false],
    ["GenuineIntel", "Intel(R) Xeon(R) 6776P", "Intel", "Xeon 6776P", "Granite Rapids", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2690 v2 @ 3.00GHz", "Intel", "Xeon E5-2690 v2", "Ivy Bridge", 3000, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz", "Intel", "Xeon E5-2690 v4", "Broadwell", 2600, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2699 v4 @ 2.20GHz", "Intel", "Xeon E5-2699 v4", "Broadwell", 2200, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E7-8880 v3 @ 2.30GHz", "Intel", "Xeon E7-8880 v3", null, 2300, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Platinum 8462Y+", "Intel", "Xeon Platinum 8462Y+", "Sapphire Rapids", null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Silver 4210R CPU @ 2.40GHz", "Intel", "Xeon Silver 4210R", "Cascade Lake", 2400, false],
    ["AuthenticAMD", "AMD EPYC 7401P 24-Core Processor", "AMD", "EPYC 7401P", "Naples", null, false],
    ["AuthenticAMD", "AMD EPYC 7742 64-Core Processor", "AMD", "EPYC 7742", "Rome", null, false],
    ["AuthenticAMD", "AMD Ryzen 7 5825U with Radeon Graphics", "AMD", "Ryzen 7 5825U", null, null, false],
    ["AuthenticAMD", "AMD Ryzen 7 7730U with Radeon Graphics", "AMD", "Ryzen 7 7730U", null, null, false],
    ["AuthenticAMD", "AMD Ryzen 9 7900X 12-Core Processor", "AMD", "Ryzen 9 7900X", "Zen 4", null, false],
    ["GenuineIntel", "Intel(R) Core(TM) i5-14500T", "Intel", "Core i5-14500T", "14th Gen", null, false],
    ["AuthenticAMD", "AMD EPYC 7713P 64-Core Processor", "AMD", "EPYC 7713P", "Milan", null, false],
    ["AuthenticAMD", "AMD EPYC 9534 64-Core Processor", "AMD", "EPYC 9534", "Genoa", null, false],
    ["AuthenticAMD", "AMD EPYC 9755 128-Core Processor", "AMD", "EPYC 9755", "Turin", null, false],
    ["AuthenticAMD", "AMD Ryzen 7 5800X 8-Core Processor", "AMD", "Ryzen 7 5800X", "Zen 3", null, false],
    ["AuthenticAMD", "AMD Ryzen 7 7840U w/ Radeon  780M Graphics", "AMD", "Ryzen 7 7840U", null, null, false],
    ["AuthenticAMD", "AMD Ryzen 9 7945HX with Radeon Graphics", "AMD", "Ryzen 9 7945HX", null, null, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2630 v3 @ 2.40GHz", "Intel", "Xeon E5-2630 v3", "Haswell", 2400, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2667 v4 @ 3.20GHz", "Intel", "Xeon E5-2667 v4", "Broadwell", 3200, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2680 v3 @ 2.50GHz", "Intel", "Xeon E5-2680 v3", "Haswell", 2500, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2690 v3 @ 2.60GHz", "Intel", "Xeon E5-2690 v3", "Haswell", 2600, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2695 v4 @ 2.10GHz", "Intel", "Xeon E5-2695 v4", "Broadwell", 2100, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2696 v3 @ 2.30GHz", "Intel", "Xeon E5-2696 v3", "Haswell", 2300, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2696 v4 @ 2.20GHz", "Intel", "Xeon E5-2696 v4", "Broadwell", 2200, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2697 v3 @ 2.60GHz", "Intel", "Xeon E5-2697 v3", "Haswell", 2600, false],
    ["GenuineIntel", "Intel(R) Xeon(R) Gold 6138 CPU @ 2.00GHz", "Intel", "Xeon Gold 6138", "Skylake", 2000, false],
    ["GenuineIntel", "Intel(R) Xeon(R) W-2133 CPU @ 3.60GHz", "Intel", "Xeon W-2133", null, 3600, false],
    ["GenuineIntel", "QEMU Virtual CPU version 2.5+", null, "QEMU Virtual version 2.5+", null, null, true],
    ["GenuineIntel", "11th Gen Intel(R) Core(TM) i7-11700F @ 2.50GHz", "Intel", "Core i7-11700F", "11th Gen", 2500, false],
    ["GenuineIntel", "12th Gen Intel(R) Core(TM) i5-12500T", "Intel", "Core i5-12500T", "12th Gen", null, false],
    ["AuthenticAMD", "AMD EPYC 7502P 32-Core Processor", "AMD", "EPYC 7502P", "Rome", null, false],
    ["AuthenticAMD", "AMD EPYC 7663 56-Core Processor", "AMD", "EPYC 7663", "Milan", null, false],
    ["AuthenticAMD", "AMD EPYC 7702 64-Core Processor", "AMD", "EPYC 7702", "Rome", null, false],
    ["AuthenticAMD", "AMD EPYC 9454P 48-Core Processor", "AMD", "EPYC 9454P", "Genoa", null, false],
    ["AuthenticAMD", "AMD EPYC 9555P 64-Core Processor", "AMD", "EPYC 9555P", "Turin", null, false],
    ["AuthenticAMD", "AMD EPYC 9754 128-Core Processor", "AMD", "EPYC 9754", "Bergamo", null, false],
    ["AuthenticAMD", "AMD Ryzen 5 PRO 5650GE with Radeon Graphics", "AMD", "Ryzen 5 PRO 5650GE", null, null, false],
    ["AuthenticAMD", "AMD Ryzen 7 5700G with Radeon Graphics", "AMD", "Ryzen 7 5700G", null, null, false],
    ["AuthenticAMD", "AMD Ryzen 9 7900 12-Core Processor", "AMD", "Ryzen 9 7900", "Zen 4", null, false],
    ["AuthenticAMD", "AMD Ryzen 9 9950X3D 16-Core Processor", "AMD", "Ryzen 9 9950X3D", "Zen 5", null, false],
    ["AuthenticAMD", "AMD Ryzen Threadripper PRO 3975WX 32-Cores", "AMD", "Ryzen Threadripper PRO 3975WX", null, null, false],
    ["GenuineIntel", "Intel(R) Core(TM) i5-10500T CPU @ 2.30GHz", "Intel", "Core i5-10500T", "10th Gen", 2300, false],
    ["GenuineIntel", "Intel(R) Core(TM) i5-14400", "Intel", "Core i5-14400", "14th Gen", null, false],
    ["GenuineIntel", "Intel(R) Core(TM) i5-9500T CPU @ 2.20GHz", "Intel", "Core i5-9500T", "9th Gen", 2200, false],
    ["GenuineIntel", "Intel(R) Core(TM) i7-14700K", "Intel", "Core i7-14700K", "14th Gen", null, false],
    ["GenuineIntel", "Intel(R) Core(TM) i7-6700 CPU @ 3.40GHz", "Intel", "Core i7-6700", "6th Gen", 3400, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2660 v3 @ 2.60GHz", "Intel", "Xeon E5-2660 v3", "Haswell", 2600, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2683 v4 @ 2.10GHz", "Intel", "Xeon E5-2683 v4", "Broadwell", 2100, false],
    ["GenuineIntel", "Intel(R) Xeon(R) CPU E5-2697 v2 @ 2.70GHz", "Intel", "Xeon E5-2697 v2", "Ivy Bridge", 2700, false],
    ["GenuineIntel", "Intel(R) Xeon(R) W-2235 CPU @ 3.80GHz", "Intel", "Xeon W-2235", null, 3800, false]
  ])(
    "describes %j %j as %s %j, generation %j, base %j MHz, virtual %j",
    (reportedVendor, reportedModel, vendor, model, generation, baseFrequencyMhz, isVirtual) => {
      expect(describeCpu(reportedVendor, reportedModel)).toEqual({ vendor, model, generation, baseFrequencyMhz, isVirtual });
    }
  );
});
