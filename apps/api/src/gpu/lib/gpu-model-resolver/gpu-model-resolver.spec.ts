import { describe, expect, it } from "vitest";

import type { ProviderConfigGpusType } from "@src/types/gpu";
import { buildGpuCatalogIndex, resolveGpuModel } from "./gpu-model-resolver";

const CATALOG: ProviderConfigGpusType = {
  "10de": {
    name: "nvidia",
    devices: {
      "1eb8": { name: "t4", memory_size: "16Gi", interface: "PCIe" },
      "20b2": { name: "a100", memory_size: "80Gi", interface: "SXM4" },
      "2330": { name: "h100", memory_size: "80Gi", interface: "SXM5" },
      "2331": { name: "h100", memory_size: "80Gi", interface: "PCIe" },
      "2335": { name: "h200", memory_size: "141Gi", interface: "SXM5" },
      "2684": { name: "rtx4090", memory_size: "24Gi", interface: "PCIe" },
      "26b9": { name: "l40s", memory_size: "48Gi", interface: "PCIe" },
      "2bb1": { name: "pro6000", memory_size: "96Gi", interface: "PCIe" },
      "2236": { name: "a10", memory_size: "24Gi", interface: "PCIe" }
    }
  },
  "1002": {
    name: "amd",
    devices: {
      "738c": { name: "mi100", memory_size: "32Gi", interface: "PCIe" },
      "66a1": { name: "mi60", memory_size: "32Gi", interface: "PCIe" }
    }
  }
};

describe("resolveGpuModel", () => {
  describe("by reported name", () => {
    it.each([
      ["NVIDIA H100 80GB HBM3", "h100", "sxm"],
      ["NVIDIA A100-SXM4-40GB", "a100", "sxm"],
      ["NVIDIA GeForce RTX 4090", "rtx4090", "pcie"],
      ["Tesla T4", "t4", "pcie"],
      ["NVIDIA L40S", "l40s", "pcie"],
      ["NVIDIA H100 PCIe", "h100", "pcie"],
      ["NVIDIA H200 NVL", "h200", "sxm"],
      ["NVIDIA A10G", "a10", "pcie"],
      ["NVIDIA RTX PRO 6000 Blackwell Server Edition", "pro6000", "pcie"]
    ])("reads %s as %s", (rawName, model, gpuInterface) => {
      const resolved = resolveGpuModel({ rawName, pciDeviceId: null }, setup());

      expect(resolved).toEqual({ vendor: "nvidia", model, interface: gpuInterface });
    });

    it("resolves an amd product name through the same path", () => {
      const resolved = resolveGpuModel({ rawName: "AMD Instinct MI100", pciDeviceId: null }, setup());

      expect(resolved).toEqual({ vendor: "amd", model: "mi100", interface: "pcie" });
    });

    it("leaves a card the catalog does not list unresolved rather than guessing", () => {
      const resolved = resolveGpuModel({ rawName: "Some Future Card", pciDeviceId: null }, setup());

      expect(resolved).toEqual({ vendor: null, model: null, interface: null });
    });

    it("leaves a name that reduces to nothing unresolved", () => {
      const resolved = resolveGpuModel({ rawName: "NVIDIA Graphics", pciDeviceId: null }, setup());

      expect(resolved.model).toBeNull();
    });
  });

  describe("by reported pci id", () => {
    it("reads the device and vendor nvidia packs into one word", () => {
      const resolved = resolveGpuModel({ rawName: "irrelevant", pciDeviceId: "0x233010DE" }, setup());

      expect(resolved).toEqual({ vendor: "nvidia", model: "h100", interface: "sxm" });
    });

    it("reads the bare device id rocm reports", () => {
      const resolved = resolveGpuModel({ rawName: "irrelevant", pciDeviceId: "0x738c" }, setup());

      expect(resolved).toEqual({ vendor: "amd", model: "mi100", interface: "pcie" });
    });

    it("prefers the pci id over a name that disagrees with it", () => {
      const resolved = resolveGpuModel({ rawName: "NVIDIA GeForce RTX 4090", pciDeviceId: "0x233010DE" }, setup());

      expect(resolved.model).toBe("h100");
    });

    it("distinguishes two cards of one model by the interface their device ids carry", () => {
      const sxm = resolveGpuModel({ rawName: "NVIDIA H100", pciDeviceId: "0x233010DE" }, setup());
      const pcie = resolveGpuModel({ rawName: "NVIDIA H100", pciDeviceId: "0x233110DE" }, setup());

      expect([sxm.interface, pcie.interface]).toEqual(["sxm", "pcie"]);
    });

    it("falls back to the name when the pci id is not in the catalog", () => {
      const resolved = resolveGpuModel({ rawName: "Tesla T4", pciDeviceId: "0xdead10de" }, setup());

      expect(resolved.model).toBe("t4");
    });
  });

  it("resolves nothing when the catalog could not be read", () => {
    const resolved = resolveGpuModel({ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE" }, null);

    expect(resolved).toEqual({ vendor: null, model: null, interface: null });
  });

  it("refuses a bare device id two vendors both claim", () => {
    const index = buildGpuCatalogIndex({
      "10de": { name: "nvidia", devices: { "1234": { name: "h100", memory_size: "80Gi", interface: "SXM5" } } },
      "1002": { name: "amd", devices: { "1234": { name: "mi100", memory_size: "32Gi", interface: "PCIe" } } }
    });

    const resolved = resolveGpuModel({ rawName: "unknown", pciDeviceId: "0x1234" }, index);

    expect(resolved.model).toBeNull();
  });

  function setup() {
    return buildGpuCatalogIndex(CATALOG);
  }
});
