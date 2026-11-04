import { describe, expect, it } from "vitest";

import { describeSpec, describeSpecGpus, describeSpecRegion } from "./hardware-request-spec-summary";

import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

describe("hardware request spec summary", () => {
  describe(describeSpecGpus.name, () => {
    it.each([
      { count: 1, text: "1× A100" },
      { count: 7, text: "7× A100" },
      { count: 8, text: "8× A100 (1 node)" },
      { count: 9, text: "9× A100 (2 nodes)" },
      { count: 32, text: "32× A100 (4 nodes)" }
    ])("describes $count GPUs as '$text'", ({ count, text }) => {
      const spec = createHardwareRequestSpec({ gpu: { model: "A100", count, interconnect: "none" } });

      expect(describeSpecGpus(spec)).toBe(text);
    });
  });

  describe(describeSpecRegion.name, () => {
    it.each([
      { region: { mode: "any", areas: [] }, text: "Anywhere" },
      { region: { mode: "only", areas: ["apac"] }, text: "Asia Pacific" },
      {
        region: { mode: "only", areas: ["us", "ca", "eu", "uk", "apac", "me", "latam"] },
        text: "United States, Canada, Europe, United Kingdom, Asia Pacific, Middle East, Latin America"
      },
      { region: { mode: "except", areas: ["eu", "uk"] }, text: "Anywhere except Europe, United Kingdom" }
    ] as const)("describes $region.mode $region.areas as '$text'", ({ region, text }) => {
      const spec = createHardwareRequestSpec({ region: { mode: region.mode, areas: [...region.areas] } });

      expect(describeSpecRegion(spec)).toBe(text);
    });
  });

  describe(describeSpec.name, () => {
    it("lists every answer of a full request in the order the form asks them", () => {
      const spec = createHardwareRequestSpec({
        gpu: { model: "H200", count: 16, interconnect: "cluster", fabric: "infiniband", fabricGbps: 400 },
        region: { mode: "only", areas: ["us", "ca"] },
        uplinkGbps: 25,
        storage: { tbPerNode: 10, nvme: true },
        sla: "99.5",
        targetPrice: { minUsdPerGpuHour: 2.4, maxUsdPerGpuHour: 2.9 },
        term: "12_months",
        start: { kind: "date", date: "2026-12-01" },
        couldGrow: true,
        wantsToTalk: true,
        company: "Acme",
        phone: "+1 555 0100"
      });

      expect(describeSpec(spec)).toEqual([
        "16× H200 (2 nodes)",
        "InfiniBand between servers at 400 Gb/s",
        "United States, Canada",
        "Internet 25 Gbps",
        "10 TB NVMe storage per node",
        "99.5% uptime",
        "$2.40–$2.90 per GPU-hour",
        "1 year, starting 2026-12-01",
        "Could grow",
        "Wants to talk to someone",
        "Company: Acme",
        "Phone: +1 555 0100"
      ]);
    });

    it("leaves out the answers a minimal request skips", () => {
      const spec = createHardwareRequestSpec({
        gpu: { model: "RTX 5090", count: 1, interconnect: "none" },
        region: { mode: "any", areas: [] },
        uplinkGbps: null,
        storage: { tbPerNode: 0, nvme: false },
        sla: null,
        targetPrice: null,
        term: "month_to_month",
        start: { kind: "asap" },
        couldGrow: false,
        wantsToTalk: false
      });

      expect(describeSpec(spec)).toEqual(["1× RTX 5090", "Anywhere", "Open to offers", "Month to month, as soon as possible"]);
    });

    it.each([
      { gpu: { interconnect: "server" }, line: "Interconnect inside each server" },
      { gpu: { interconnect: "cluster" }, line: "InfiniBand or RoCE between servers" },
      { gpu: { interconnect: "cluster", fabric: "any", fabricGbps: 800 }, line: "InfiniBand or RoCE between servers at 800 Gb/s" },
      { gpu: { interconnect: "cluster", fabric: "roce", fabricGbps: 200 }, line: "RoCE between servers at 200 Gb/s" }
    ] as const)("describes the $gpu.interconnect interconnect as '$line'", ({ gpu, line }) => {
      const spec = createHardwareRequestSpec({ gpu: { model: "B200", count: 32, ...gpu } });

      expect(describeSpec(spec)[1]).toBe(line);
    });

    it.each([
      { targetPrice: { maxUsdPerGpuHour: 3 }, line: "Up to $3.00 per GPU-hour" },
      { targetPrice: { minUsdPerGpuHour: 1.5 }, line: "From $1.50 per GPU-hour" },
      { targetPrice: {}, line: "Open to offers" }
    ])("describes the target price $targetPrice as '$line'", ({ targetPrice, line }) => {
      const spec = createHardwareRequestSpec({ targetPrice });

      expect(describeSpec(spec)).toContain(line);
    });

    it.each([
      { term: "3_months", start: { kind: "flexible" }, line: "3 months, flexible start" },
      { term: "6_months", start: { kind: "asap" }, line: "6 months, as soon as possible" },
      { term: "24_months", start: { kind: "asap" }, line: "2 years or more, as soon as possible" }
    ] as const)("describes the term and start as '$line'", ({ term, start, line }) => {
      const spec = createHardwareRequestSpec({ term, start });

      expect(describeSpec(spec)).toContain(line);
    });

    it("describes storage without NVMe", () => {
      const spec = createHardwareRequestSpec({ storage: { tbPerNode: 2, nvme: false } });

      expect(describeSpec(spec)).toContain("2 TB storage per node");
    });
  });
});
