import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList, ApiProviderLocation, StatsItem } from "@src/types/provider";
import {
  formatBytes,
  formatCompactCount,
  formatGpuModel,
  formatProviderLocation,
  formatUptime,
  getProviderName,
  getUptimeQuality,
  parseCoordinates,
  summarizeListedProvider,
  summarizeLocatedProvider,
  totalOf
} from "./providerSummary";

describe("providerSummary", () => {
  describe(summarizeLocatedProvider.name, () => {
    it("summarizes a located provider for the globe and the panel", () => {
      const location = Object.assign(mock<ApiProviderLocation>(), {
        owner: "akash1located",
        name: "provider.example.com",
        hostUri: "https://provider.example.com:8443",
        ipRegion: "Quebec",
        ipCountryCode: "CA",
        ipLat: "45.5",
        ipLon: "-73.6",
        isAudited: true,
        locationRegion: "na-ca-central",
        uptime30d: 0.995,
        gpuModels: ["h100", "a100"],
        stats: createStats({ cpu: 64_000, gpu: 8, memory: 512e9, ephemeral: 1e12, persistent: 2e12 })
      });

      expect(summarizeLocatedProvider(location)).toEqual({
        owner: "akash1located",
        name: "provider.example.com",
        hostUri: "https://provider.example.com:8443",
        location: "Quebec, CA",
        locationRegion: "na-ca-central",
        isAudited: true,
        uptime30d: 0.995,
        gpuCount: 8,
        gpuModels: ["h100", "a100"],
        vcpuCount: 64,
        memoryBytes: 512e9,
        storageBytes: 3e12,
        coordinates: { lat: 45.5, lng: -73.6 }
      });
    });
  });

  describe(summarizeListedProvider.name, () => {
    it("names each GPU model once and keeps an unset region and uptime empty", () => {
      const provider = Object.assign(mock<ApiProviderList>(), {
        owner: "akash1listed",
        name: null,
        hostUri: "https://offline.example.com:8443",
        ipRegion: "",
        ipCountryCode: "",
        ipLat: "",
        ipLon: "",
        isAudited: false,
        locationRegion: "",
        uptime30d: undefined as unknown as number,
        gpuModels: [
          { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM" },
          { vendor: "nvidia", model: "h100", ram: "94Gi", interface: "SXM" }
        ],
        stats: createStats({ cpu: 1500, gpu: 0, memory: 0, ephemeral: 0, persistent: 0 })
      });

      expect(summarizeListedProvider(provider)).toMatchObject({
        name: "offline.example.com",
        location: null,
        locationRegion: null,
        uptime30d: null,
        gpuModels: ["h100"],
        vcpuCount: 2,
        coordinates: null
      });
    });
  });

  describe(getProviderName.name, () => {
    it("prefers the provider's name", () => {
      expect(getProviderName({ name: "provider.named.com", hostUri: "https://other.example.com:8443" })).toBe("provider.named.com");
    });

    it("falls back to the host of its URI", () => {
      expect(getProviderName({ name: null, hostUri: "https://provider.example.com:8443" })).toBe("provider.example.com");
    });

    it("falls back to the raw URI when it can't be parsed", () => {
      expect(getProviderName({ name: null, hostUri: "not a uri" })).toBe("not a uri");
    });
  });

  describe(formatProviderLocation.name, () => {
    it("joins the region and the country", () => {
      expect(formatProviderLocation("Missouri", "US")).toBe("Missouri, US");
    });

    it("shows whichever part is known", () => {
      expect(formatProviderLocation(null, "US")).toBe("US");
    });

    it("is empty when neither part is known", () => {
      expect(formatProviderLocation(undefined, "")).toBeNull();
    });
  });

  describe(parseCoordinates.name, () => {
    it("reads latitude and longitude", () => {
      expect(parseCoordinates("38.63", "-90.2")).toEqual({ lat: 38.63, lng: -90.2 });
    });

    it("is empty when a coordinate is missing or not a number", () => {
      expect(parseCoordinates(null, "-90.2")).toBeNull();
      expect(parseCoordinates("38.63", "")).toBeNull();
      expect(parseCoordinates("north", "-90.2")).toBeNull();
    });
  });

  describe(totalOf.name, () => {
    it("adds active, available and pending", () => {
      expect(totalOf({ active: 1, available: 2, pending: 3 })).toBe(6);
    });
  });

  describe(formatGpuModel.name, () => {
    it("upper-cases the model", () => {
      expect(formatGpuModel("rtx4090")).toBe("RTX4090");
    });
  });

  describe(formatUptime.name, () => {
    it("shows the uptime as a percentage with at most two decimals", () => {
      expect(formatUptime(0.99567)).toBe("99.57%");
      expect(formatUptime(1)).toBe("100%");
      expect(formatUptime(0.999)).toBe("99.9%");
    });
  });

  describe(getUptimeQuality.name, () => {
    it("rates an uptime above 99.9% excellent", () => {
      expect(getUptimeQuality(0.9991)).toBe("excellent");
    });

    it("rates an uptime above 99% healthy", () => {
      expect(getUptimeQuality(0.999)).toBe("healthy");
      expect(getUptimeQuality(0.9901)).toBe("healthy");
    });

    it("rates an uptime of 99% or less variable", () => {
      expect(getUptimeQuality(0.99)).toBe("variable");
    });
  });

  describe(formatBytes.name, () => {
    it("rounds sizes of ten units or more to whole units", () => {
      expect(formatBytes(476.4e9)).toBe("476 GB");
    });

    it("keeps one decimal below ten units", () => {
      expect(formatBytes(1.234e12)).toBe("1.2 TB");
      expect(formatBytes(7e12)).toBe("7 TB");
    });
  });

  describe(formatCompactCount.name, () => {
    it("shortens large counts", () => {
      expect(formatCompactCount(8868)).toBe("8.9K");
      expect(formatCompactCount(512)).toBe("512");
    });
  });

  function createStats(totals: { cpu: number; gpu: number; memory: number; ephemeral: number; persistent: number }): ApiProviderList["stats"] {
    const item = (total: number): StatsItem => ({ active: 0, available: total, pending: 0, total });
    return {
      cpu: item(totals.cpu),
      gpu: item(totals.gpu),
      memory: item(totals.memory),
      storage: { ephemeral: item(totals.ephemeral), persistent: item(totals.persistent), total: item(totals.ephemeral + totals.persistent) }
    };
  }
});
