import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderStreamResult, ProviderStreamService } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildShellProbeUrl, ProviderShellProbeService, SHELL_PROBE_SCRIPT } from "./provider-shell-probe.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const TARGET = { hostUri: "https://provider.example:8443", providerAddress: "akash1provider", token: "jwt", dseq: "123", gseq: 1, oseq: 2, service: "ssh box" };

describe(ProviderShellProbeService.name, () => {
  describe("buildShellProbeUrl", () => {
    it("runs the collector script through sh without stdin or a tty on the first pod of the service", () => {
      const url = new URL(buildShellProbeUrl(TARGET));

      expect(url.origin + url.pathname).toBe("https://provider.example:8443/lease/123/1/2/shell");
      expect(url.searchParams.get("stdin")).toBe("0");
      expect(url.searchParams.get("tty")).toBe("0");
      expect(url.searchParams.get("podIndex")).toBe("0");
      expect(url.searchParams.get("cmd0")).toBe("sh");
      expect(url.searchParams.get("cmd1")).toBe("-c");
      expect(url.searchParams.get("cmd2")).toBe(SHELL_PROBE_SCRIPT);
      expect(url.searchParams.get("service")).toBe("ssh box");
    });

    it("prints expanded lines with printf so a dash echo cannot turn the script's own cmdline into NUL bytes", () => {
      expect(SHELL_PROBE_SCRIPT).toContain("printf '%s\\n' \"${p#/proc/} comm=");
      expect(SHELL_PROBE_SCRIPT).toContain("printf '%s\\n' \"== $f\"");
      expect(SHELL_PROBE_SCRIPT).not.toMatch(/echo "/);
    });
  });

  describe("run", () => {
    it("joins stdout and stderr into the output and keeps the stream status", async () => {
      const { service } = setup({
        status: "completed",
        exitCode: 0,
        frames: [
          { kind: "shell", stream: "stdout", payload: "--loadavg\n1.00" },
          { kind: "shell", stream: "stderr", payload: "\nwarn" },
          { kind: "shell", stream: "result", payload: '{"exit_code":0}' }
        ]
      });

      const result = await service.run(TARGET);

      expect(result).toEqual({ status: "completed", output: "--loadavg\n1.00\nwarn", exitCode: 0 });
    });

    it("reports the shell as unavailable when the provider fails to exec or nothing comes back", async () => {
      const { service: failing } = setup({ status: "completed", frames: [{ kind: "shell", stream: "failure", payload: "executable file not found" }] });
      const { service: silent } = setup({ status: "completed", exitCode: 0, frames: [] });

      expect((await failing.run(TARGET)).status).toBe("shell_unavailable");
      expect((await silent.run(TARGET)).status).toBe("shell_unavailable");
    });

    it("passes a transport failure through untouched", async () => {
      const { service } = setup({ status: "token_expired", frames: [], error: "tokenExpired" });

      expect((await service.run(TARGET)).status).toBe("token_expired");
    });
  });

  function setup(result: ProviderStreamResult) {
    const providerStreamService = mock<ProviderStreamService>();
    providerStreamService.collect.mockResolvedValue(result);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS: 5_000,
      WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS: 30_000,
      WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES: 65_536
    });
    const service = new ProviderShellProbeService(providerStreamService, config);

    return { service, providerStreamService };
  }
});
