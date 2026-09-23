import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { ProviderStreamResult, ProviderStreamService } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import { buildLeaseGpuProbeUrl, LeaseGpuProbeService } from "./lease-gpu-probe.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const TARGET = {
  hostUri: "https://provider.example:8443",
  providerAddress: "akash1provider",
  token: "jwt",
  dseq: "123",
  gseq: 1,
  oseq: 2,
  service: "web app",
  podIndex: 0
};
const NVIDIA_LINE = "NVIDIA H100 80GB HBM3, 81559, 550.54.15, 0x233010DE";

describe(LeaseGpuProbeService.name, () => {
  describe("buildLeaseGpuProbeUrl", () => {
    it("runs the collector through sh without stdin or a tty on the pod it names", () => {
      const url = new URL(buildLeaseGpuProbeUrl({ ...TARGET, podIndex: 2 }));

      expect(url.origin + url.pathname).toBe("https://provider.example:8443/lease/123/1/2/shell");
      expect(url.searchParams.get("stdin")).toBe("0");
      expect(url.searchParams.get("tty")).toBe("0");
      expect(url.searchParams.get("podIndex")).toBe("2");
      expect(url.searchParams.get("cmd0")).toBe("sh");
      expect(url.searchParams.get("cmd1")).toBe("-c");
      expect(url.searchParams.get("service")).toBe("web app");
    });

    it("asks only what the card is and nothing about what runs on it", () => {
      const collector = collectorOf(buildLeaseGpuProbeUrl(TARGET));

      expect(collector).toContain("--query-gpu=name,memory.total,driver_version,pci.device_id");
      expect(collector).not.toContain("query-compute-apps");
      expect(collector).not.toContain("/proc");
      expect(collector).not.toContain("find /");
      expect(collector).not.toContain("authorized_keys");
    });
  });

  describe("the collector as a shell program", () => {
    it("reports the cards nvidia-smi lists", () => {
      expect(runCollector({ "nvidia-smi": `printf '${NVIDIA_LINE}\\n'` })).toEqual({ output: ["--nvidia", NVIDIA_LINE], exitCode: 0 });
    });

    it("falls through to rocm-smi when only that one is installed", () => {
      expect(runCollector({ "rocm-smi": "printf 'device,Card Series\\ncard0,Instinct MI100\\n'" })).toEqual({
        output: ["--amd", "device,Card Series", "card0,Instinct MI100"],
        exitCode: 0
      });
    });

    it("prefers nvidia-smi when a container carries both", () => {
      expect(runCollector({ "nvidia-smi": `printf '${NVIDIA_LINE}\\n'`, "rocm-smi": "printf 'unexpected\\n'" })).toEqual({
        output: ["--nvidia", NVIDIA_LINE],
        exitCode: 0
      });
    });

    it("says so when the container has neither", () => {
      expect(runCollector({})).toEqual({ output: ["gpu: unavailable"], exitCode: 0 });
    });

    it("exits with the status of a tool that fails", () => {
      expect(runCollector({ "nvidia-smi": "exit 9" })).toEqual({ output: ["--nvidia"], exitCode: 9 });
    });
  });

  describe("probe", () => {
    it("reads the cards the workload reported", async () => {
      const { service } = setup({ status: "completed", exitCode: 0, frames: [{ kind: "shell", stream: "stdout", payload: `--nvidia\n${NVIDIA_LINE}\n` }] });

      const result = await service.probe(TARGET);

      expect(result).toEqual({
        status: "detected",
        reading: {
          source: "nvidia-smi",
          driverVersion: "550.54.15",
          gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }]
        }
      });
    });

    it("reads stdout alone, so a line the provider split across frames stays whole around anything else on the stream", async () => {
      const { service } = setup({
        status: "completed",
        exitCode: 0,
        frames: [
          { kind: "shell", stream: "stdout", payload: "--nvidia\nNVIDIA H100 80GB HBM3, 81559, " },
          { kind: "shell", stream: "stderr", payload: "sh: warning\n" },
          { kind: "text", payload: "provider notice" },
          { kind: "shell", stream: "stdout", payload: "550.54.15, 0x233010DE\n" },
          { kind: "shell", stream: "result", payload: '{"exit_code":0}' }
        ]
      });

      const result = await service.probe(TARGET);

      expect(result).toEqual({
        status: "detected",
        reading: {
          source: "nvidia-smi",
          driverVersion: "550.54.15",
          gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }]
        }
      });
    });

    it("reads a container without a gpu tool as a reading rather than a failure", async () => {
      const { service } = setup({ status: "completed", exitCode: 0, frames: [{ kind: "shell", stream: "stdout", payload: "gpu: unavailable\n" }] });

      const result = await service.probe(TARGET);

      expect(result).toEqual({ status: "detected", reading: { source: "none", driverVersion: null, gpus: [] } });
    });

    it("reports the stream's own failure rather than inventing a reading", async () => {
      const { service } = setup({ status: "invalid_certificate", frames: [] });

      await expect(service.probe(TARGET)).resolves.toEqual({ status: "invalid_certificate" });
    });

    it.each(["output_capped", "idle_timeout", "hard_timeout"] as const)("reports a session cut short by %s rather than the cards it got to", async status => {
      const { service } = setup({ status, frames: [{ kind: "shell", stream: "stdout", payload: `--nvidia\n${NVIDIA_LINE}\n` }] });

      await expect(service.probe(TARGET)).resolves.toEqual({ status });
    });

    it("reports a session that completed with nothing it could read", async () => {
      const { service } = setup({ status: "completed", exitCode: 0, frames: [{ kind: "shell", stream: "stderr", payload: "sh: 1: not found\n" }] });

      await expect(service.probe(TARGET)).resolves.toEqual({ status: "unreadable" });
    });

    it("reports a tool that failed as unreadable rather than as a host without cards", async () => {
      const { service } = setup({ status: "completed", exitCode: 9, frames: [{ kind: "shell", stream: "stdout", payload: "--nvidia\n" }] });

      await expect(service.probe(TARGET)).resolves.toEqual({ status: "unreadable" });
    });

    it("reports a session the provider closed without an exit status as unreadable", async () => {
      const { service } = setup({ status: "completed", frames: [{ kind: "shell", stream: "stdout", payload: `--nvidia\n${NVIDIA_LINE}\n` }] });

      await expect(service.probe(TARGET)).resolves.toEqual({ status: "unreadable" });
    });

    it("holds the stream to the budget a handful of csv lines needs", async () => {
      const { service, providerStreamService } = setup({ status: "completed", frames: [] });

      await service.probe(TARGET);

      expect(providerStreamService.collect).toHaveBeenCalledWith(
        expect.objectContaining({ idleTimeoutMs: 3_000, hardTimeoutMs: 10_000, maxBytes: 8_192, token: "jwt", providerAddress: "akash1provider" })
      );
    });
  });

  function collectorOf(url: string): string {
    return new URL(url).searchParams.get("cmd2") ?? "";
  }

  function runCollector(tools: Record<string, string>) {
    const directory = mkdtempSync(join(tmpdir(), "lease-gpu-probe-"));

    for (const [name, body] of Object.entries(tools)) {
      const path = join(directory, name);
      writeFileSync(path, `#!/bin/sh\n${body}\n`);
      chmodSync(path, 0o755);
    }

    const { stdout, status } = spawnSync("/bin/sh", ["-c", collectorOf(buildLeaseGpuProbeUrl(TARGET))], {
      encoding: "utf8",
      env: { PATH: directory }
    });

    const output = stdout
      .split("\n")
      .filter(line => line.trim())
      .map(line => line.trimEnd());

    return { output, exitCode: status };
  }

  function setup(result: ProviderStreamResult) {
    const providerStreamService = mock<ProviderStreamService>();
    providerStreamService.collect.mockResolvedValue(result);
    const config = mockConfigService<DeploymentConfigService>({
      LEASE_GPU_DETECTION_IDLE_TIMEOUT_MS: 3_000,
      LEASE_GPU_DETECTION_HARD_TIMEOUT_MS: 10_000,
      LEASE_GPU_DETECTION_MAX_OUTPUT_BYTES: 8_192
    });
    const service = new LeaseGpuProbeService(providerStreamService, config);

    return { service, providerStreamService };
  }
});
