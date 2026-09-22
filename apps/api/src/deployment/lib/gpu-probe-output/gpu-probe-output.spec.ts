import { describe, expect, it } from "vitest";

import { parseGpuProbeOutput } from "./gpu-probe-output";

describe("parseGpuProbeOutput", () => {
  describe("nvidia", () => {
    it("reads a card and the driver behind it", () => {
      const reading = parseGpuProbeOutput("--nvidia\nNVIDIA H100 80GB HBM3, 81559, 550.54.15, 0x233010DE\n");

      expect(reading).toEqual({
        source: "nvidia-smi",
        driverVersion: "550.54.15",
        gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }]
      });
    });

    it("folds identical cards into one entry carrying how many there are", () => {
      const line = "NVIDIA H100 80GB HBM3, 81559, 550.54.15, 0x233010DE";
      const reading = parseGpuProbeOutput(`--nvidia\n${line}\n${line}\n${line}\n`);

      expect(reading?.gpus).toEqual([expect.objectContaining({ count: 3 })]);
    });

    it("keeps unlike cards apart", () => {
      const reading = parseGpuProbeOutput("--nvidia\nNVIDIA H100 80GB HBM3, 81559, 550.54.15, 0x233010DE\nNVIDIA L40S, 46068, 550.54.15, 0x26B910DE\n");

      expect(reading?.gpus.map(gpu => gpu.rawName)).toEqual(["NVIDIA H100 80GB HBM3", "NVIDIA L40S"]);
    });

    it("keeps a model name that carries a comma whole", () => {
      const reading = parseGpuProbeOutput("--nvidia\nNVIDIA RTX PRO 6000, Blackwell Edition, 98304, 570.1, 0x2BB110DE\n");

      expect(reading?.gpus[0]).toEqual({
        rawName: "NVIDIA RTX PRO 6000, Blackwell Edition",
        pciDeviceId: "0x2BB110DE",
        memoryMb: 98304,
        count: 1
      });
    });

    it("keeps a card whose driver answered a field with a placeholder", () => {
      const reading = parseGpuProbeOutput("--nvidia\nNVIDIA A100-SXM4-40GB, [N/A], [N/A], 0x20B210DE\n");

      expect(reading).toEqual({
        source: "nvidia-smi",
        driverVersion: null,
        gpus: [{ rawName: "NVIDIA A100-SXM4-40GB", pciDeviceId: "0x20B210DE", memoryMb: 0, count: 1 }]
      });
    });

    it("ignores a line with too few fields to read", () => {
      const reading = parseGpuProbeOutput("--nvidia\nsomething the container printed\nNVIDIA L40S, 46068, 550.54.15, 0x26B910DE\n");

      expect(reading?.gpus).toHaveLength(1);
    });

    it("reads a section that reported no cards as a gpu tool that found none", () => {
      const reading = parseGpuProbeOutput("--nvidia\n");

      expect(reading).toEqual({ source: "nvidia-smi", driverVersion: null, gpus: [] });
    });
  });

  describe("amd", () => {
    it("finds its columns by heading rather than by position", () => {
      const reading = parseGpuProbeOutput(
        [
          "--amd",
          "device,Device ID,Card Series,Card Vendor,VRAM Total Memory (B),VRAM Total Used Memory (B)",
          "card0,0x738c,Instinct MI100,Advanced Micro Devices Inc.,34342961152,10960896"
        ].join("\n")
      );

      expect(reading).toEqual({
        source: "rocm-smi",
        driverVersion: null,
        gpus: [{ rawName: "Instinct MI100", pciDeviceId: "0x738c", memoryMb: 32752, count: 1 }]
      });
    });

    it("reads a reordered heading the same way", () => {
      const reading = parseGpuProbeOutput(
        ["--amd", "device,Card Series,VRAM Total Memory (B),Device ID", "card0,Instinct MI100,34342961152,0x738c"].join("\n")
      );

      expect(reading?.gpus[0]).toEqual({ rawName: "Instinct MI100", pciDeviceId: "0x738c", memoryMb: 32752, count: 1 });
    });

    it("still reports the card when the heading names no device id", () => {
      const reading = parseGpuProbeOutput(["--amd", "device,Card Series,VRAM Total Memory (B)", "card0,Instinct MI100,34342961152"].join("\n"));

      expect(reading?.gpus[0]).toEqual({ rawName: "Instinct MI100", pciDeviceId: null, memoryMb: 32752, count: 1 });
    });

    it("reports no card when the heading names nothing it recognises", () => {
      const reading = parseGpuProbeOutput(["--amd", "a,b,c", "1,2,3"].join("\n"));

      expect(reading).toEqual({ source: "rocm-smi", driverVersion: null, gpus: [] });
    });
  });

  it("reads a container that ran the probe and had no gpu tool", () => {
    const reading = parseGpuProbeOutput("gpu: unavailable\n");

    expect(reading).toEqual({ source: "none", driverVersion: null, gpus: [] });
  });

  it("reads output carrying no section at all as no answer", () => {
    expect(parseGpuProbeOutput("")).toBeNull();
    expect(parseGpuProbeOutput("sh: 1: syntax error\n")).toBeNull();
  });

  it("prefers the nvidia section when a container printed both markers", () => {
    const reading = parseGpuProbeOutput("--amd\ndevice,Card Series\ncard0,Instinct MI100\n--nvidia\nTesla T4, 15360, 535.1, 0x1EB810DE\n");

    expect(reading?.source).toBe("nvidia-smi");
  });
});
