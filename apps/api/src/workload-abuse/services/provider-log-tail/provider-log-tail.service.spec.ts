import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderStreamResult, ProviderStreamService } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildLogTailUrl, formatLogFrame, ProviderLogTailService } from "./provider-log-tail.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const TARGET = {
  hostUri: "https://provider.example:8443",
  providerAddress: "akash1provider",
  token: "jwt",
  dseq: "123",
  gseq: 1,
  oseq: 2,
  services: ["web", "db"]
};

describe(ProviderLogTailService.name, () => {
  describe("buildLogTailUrl", () => {
    it("asks for a bounded, non-following tail of the named services", () => {
      const url = new URL(buildLogTailUrl(TARGET, 300));

      expect(url.origin + url.pathname).toBe("https://provider.example:8443/lease/123/1/2/logs");
      expect(url.searchParams.get("follow")).toBe("false");
      expect(url.searchParams.get("tail")).toBe("300");
      expect(url.searchParams.get("service")).toBe("web,db");
    });

    it("omits the service filter when no services are named", () => {
      expect(buildLogTailUrl({ ...TARGET, services: [] }, 10)).not.toContain("service=");
    });
  });

  describe("formatLogFrame", () => {
    it("renders a provider log entry as the service prefix and message", () => {
      expect(formatLogFrame('{"name":"web-7d9f","message":"listening","service":"web"}')).toBe("[web]: listening");
    });

    it("keeps a frame that is not a log entry verbatim", () => {
      expect(formatLogFrame("plain")).toBe("plain");
      expect(formatLogFrame('{"other":true}')).toBe('{"other":true}');
    });
  });

  describe("collect", () => {
    it("formats every text frame into a line", async () => {
      const { service } = setup({
        status: "completed",
        frames: [
          { kind: "text", payload: '{"name":"web-1","message":"a"}' },
          { kind: "text", payload: '{"name":"web-1","message":"b"}' }
        ]
      });

      expect(await service.collect(TARGET)).toEqual({ status: "completed", lines: ["[web]: a", "[web]: b"] });
    });
  });

  function setup(result: ProviderStreamResult) {
    const providerStreamService = mock<ProviderStreamService>();
    providerStreamService.collect.mockResolvedValue(result);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_PROBE_LOG_TAIL: 300,
      WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS: 5_000,
      WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS: 30_000,
      WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES: 65_536
    });
    const service = new ProviderLogTailService(providerStreamService, config);

    return { service, providerStreamService };
  }
});
