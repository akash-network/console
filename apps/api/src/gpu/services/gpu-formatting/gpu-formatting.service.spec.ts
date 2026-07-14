import { describe, expect, it } from "vitest";

import type { ProviderConfigGpusType } from "@src/types/gpu";
import { GpuFormattingService } from "./gpu-formatting.service";

describe(GpuFormattingService.name, () => {
  describe("formatModelName", () => {
    it("returns the curated marketing name for prioritized datacenter models", () => {
      const { service } = setup();
      expect(service.formatModelName("h100")).toBe("H100");
      expect(service.formatModelName("a100")).toBe("A100");
      expect(service.formatModelName("h200")).toBe("H200");
    });

    it("returns the curated name for GeForce models the heuristic would also produce", () => {
      const { service } = setup();
      expect(service.formatModelName("rtx4090")).toBe("RTX 4090");
      expect(service.formatModelName("rtx3090")).toBe("RTX 3090");
    });

    it("returns the curated name for marketing-irregular models the heuristic cannot infer", () => {
      const { service } = setup();
      expect(service.formatModelName("l40s")).toBe("L40S");
      expect(service.formatModelName("pro6000")).toBe("RTX PRO 6000");
      expect(service.formatModelName("pro6000se")).toBe("RTX PRO 6000 SE");
    });

    it("spaces a multi-letter consumer family from its number", () => {
      const { service } = setup();
      expect(service.formatModelName("gtx1080")).toBe("GTX 1080");
      expect(service.formatModelName("gt1030")).toBe("GT 1030");
      expect(service.formatModelName("mx150")).toBe("MX 150");
      expect(service.formatModelName("rtx4060")).toBe("RTX 4060");
    });

    it("renders a Ti suffix in title case", () => {
      const { service } = setup();
      expect(service.formatModelName("gtx1080ti")).toBe("GTX 1080 Ti");
      expect(service.formatModelName("rtx3080ti")).toBe("RTX 3080 Ti");
    });

    it("expands a Super suffix", () => {
      const { service } = setup();
      expect(service.formatModelName("gtx1650s")).toBe("GTX 1650 SUPER");
    });

    it("keeps single-letter datacenter families glued and appends other suffixes", () => {
      const { service } = setup();
      expect(service.formatModelName("a800")).toBe("A800");
      expect(service.formatModelName("h200nvl")).toBe("H200 NVL");
    });

    it("prefixes RTX workstation A-series models", () => {
      const { service } = setup();
      expect(service.formatModelName("rtxa2000")).toBe("RTX A2000");
      expect(service.formatModelName("rtxa6000")).toBe("RTX A6000");
    });

    it("normalizes case and separators before formatting", () => {
      const { service } = setup();
      expect(service.formatModelName("RTX-4090")).toBe("RTX 4090");
      expect(service.formatModelName("H100")).toBe("H100");
    });

    it("uppercases an unrecognized name as a fallback", () => {
      const { service } = setup();
      expect(service.formatModelName("titan")).toBe("TITAN");
    });
  });

  describe("formatVendorName", () => {
    it("returns the branded name for known vendors", () => {
      const { service } = setup();
      expect(service.formatVendorName("nvidia")).toBe("NVIDIA");
      expect(service.formatVendorName("amd")).toBe("AMD");
      expect(service.formatVendorName("intel")).toBe("Intel");
    });

    it("uppercases an unknown vendor as a fallback", () => {
      const { service } = setup();
      expect(service.formatVendorName("foobar")).toBe("FOOBAR");
    });
  });

  describe("mapProviderConfig", () => {
    it("adds a branded displayName to each vendor while keeping the raw name", () => {
      const { service } = setup();
      const [vendor] = service.mapProviderConfig({
        "10de": { name: "nvidia", devices: { d1: { name: "rtx4090", memory_size: "24Gi", interface: "PCIe" } } }
      });

      expect(vendor).toMatchObject({ name: "nvidia", displayName: "NVIDIA" });
    });

    it("adds a marketing displayName to each model while keeping the raw name", () => {
      const { service } = setup();
      const [vendor] = service.mapProviderConfig({
        "10de": { name: "nvidia", devices: { d1: { name: "rtx4090", memory_size: "24Gi", interface: "PCIe" } } }
      });

      expect(vendor.models[0]).toEqual({ name: "rtx4090", displayName: "RTX 4090", memory: ["24Gi"], interface: ["pcie"] });
    });

    it("collapses repeated model names into one entry with the distinct memory sizes and interfaces", () => {
      const { service } = setup();
      const payload: ProviderConfigGpusType = {
        "10de": {
          name: "nvidia",
          devices: {
            d1: { name: "a100", memory_size: "40Gi", interface: "SXM4" },
            d2: { name: "a100", memory_size: "80Gi", interface: "PCIe" },
            d3: { name: "a100", memory_size: "80Gi", interface: "PCIe" }
          }
        }
      };

      const [vendor] = service.mapProviderConfig(payload);

      expect(vendor.models).toHaveLength(1);
      expect(vendor.models[0]).toEqual({ name: "a100", displayName: "A100", memory: ["40Gi", "80Gi"], interface: ["sxm", "pcie"] });
    });

    it("normalizes any SXM interface revision down to the canonical sxm value", () => {
      const { service } = setup();
      const [vendor] = service.mapProviderConfig({
        "10de": { name: "nvidia", devices: { d1: { name: "h100", memory_size: "80Gi", interface: "SXM5" } } }
      });

      expect(vendor.models[0].interface).toEqual(["sxm"]);
    });
  });

  function setup() {
    return { service: new GpuFormattingService() };
  }
});
