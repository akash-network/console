import type { Counter } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import { WorkloadAbuseInstrumentationService } from "./workload-abuse-instrumentation.service";

describe(WorkloadAbuseInstrumentationService.name, () => {
  it("creates a counter per outcome it reports", () => {
    const { metricsService } = setup();

    expect(metricsService.createCounter).toHaveBeenCalledWith(expect.anything(), "workload_abuse_probes_total", expect.anything());
    expect(metricsService.createCounter).toHaveBeenCalledWith(expect.anything(), "workload_abuse_detections_total", expect.anything());
    expect(metricsService.createCounter).toHaveBeenCalledWith(expect.anything(), "workload_abuse_enforcements_total", expect.anything());
    expect(metricsService.createCounter).toHaveBeenCalledWith(expect.anything(), "workload_abuse_domain_blocks_total", expect.anything());
  });

  describe("recordProbe", () => {
    it("tags the probe with its verdict and status", () => {
      const { service, probes } = setup();

      service.recordProbe({ verdict: "hard", probeStatus: "completed" });

      expect(probes.add).toHaveBeenCalledWith(1, { verdict: "hard", probe_status: "completed" });
    });
  });

  describe("recordDetection", () => {
    it("tags the detection with its verdict", () => {
      const { service, detections } = setup();

      service.recordDetection("soft");

      expect(detections.add).toHaveBeenCalledWith(1, { verdict: "soft" });
    });
  });

  describe("recordEnforcement", () => {
    it("tags the enforcement with its result", () => {
      const { service, enforcements } = setup();

      service.recordEnforcement("enforced");

      expect(enforcements.add).toHaveBeenCalledWith(1, { result: "enforced" });
    });
  });

  describe("recordDomainBlock", () => {
    it("tags a block with its result", () => {
      const { service, domainBlocks } = setup();

      service.recordDomainBlock("blocked");

      expect(domainBlocks.add).toHaveBeenCalledWith(1, { result: "blocked" });
    });

    it("adds the reason to a skip, so the guardrail that fired is visible on the dashboard", () => {
      const { service, domainBlocks } = setup();

      service.recordDomainBlock("skipped", "public_provider");

      expect(domainBlocks.add).toHaveBeenCalledWith(1, { result: "skipped", reason: "public_provider" });
    });
  });

  function setup() {
    const probes = mock<Counter>();
    const detections = mock<Counter>();
    const enforcements = mock<Counter>();
    const domainBlocks = mock<Counter>();

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter
      .mockReturnValueOnce(probes)
      .mockReturnValueOnce(detections)
      .mockReturnValueOnce(enforcements)
      .mockReturnValueOnce(domainBlocks);

    const service = new WorkloadAbuseInstrumentationService(metricsService);

    return { service, metricsService, probes, detections, enforcements, domainBlocks };
  }
});
