import { describe, expect, it } from "vitest";

import { parseProbeEvidence } from "./parse-probe-evidence";

describe("parseProbeEvidence", () => {
  it("parses accelerator, processes, artifacts, process origins, and net shape from one evidence block", () => {
    const raw = [
      "--accel",
      "GPU-0001, NVIDIA T4, 95, 15130, 15360",
      "GPU-0001, 1234, python3, 15100",
      "--netl",
      "      2 listen=8080",
      "      3 0D05 140AB912:01BB 01",
      "--disk",
      "73014444032 /root/.cache/model.safetensors",
      "--procorig",
      "btime=1740000000",
      "1234 ppid=1 starttime=650000 comm=python3",
      ""
    ].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.accelerator).toEqual([
      { name: "NVIDIA T4", utilPct: 95, memUsedMb: 15130, memTotalMb: 15360, processes: [{ pid: 1234, name: "python3", vramMb: 15100 }] }
    ]);
    expect(features.artifacts).toEqual([{ path: "/root/.cache/model.safetensors", sizeBytes: 73014444032 }]);
    expect(features.processOrigins).toEqual([{ pid: 1234, ppid: 1, comm: "python3", startedAtEpochMs: 1740006500000 }]);
    expect(features.netShape).toEqual({
      listenPorts: [8080],
      connections: [{ localPort: 3333, remoteIp: "18.185.10.20", remotePort: 443, count: 3, state: "established" }]
    });
  });

  it("keeps each process on the card it ran on when the host has more than one", () => {
    const features = parseProbeEvidence(
      ["--accel", "GPU-0001, NVIDIA A100, 99, 20480, 24576", "GPU-0002, NVIDIA A100, 0, 4, 24576", "GPU-0001, 1234, trainer, 18000", ""].join("\n")
    );

    expect(features.accelerator).toEqual([
      { name: "NVIDIA A100", utilPct: 99, memUsedMb: 20480, memTotalMb: 24576, processes: [{ pid: 1234, name: "trainer", vramMb: 18000 }] },
      { name: "NVIDIA A100", utilPct: 0, memUsedMb: 4, memTotalMb: 24576, processes: [] }
    ]);
  });

  it("keeps a card and its processes when the driver reports a field as unavailable", () => {
    const features = parseProbeEvidence("--accel\nGPU-0001, NVIDIA A100, [N/A], 20480, 24576\nGPU-0001, 1234, trainer, 18000\n");

    expect(features.accelerator).toEqual([
      { name: "NVIDIA A100", utilPct: 0, memUsedMb: 20480, memTotalMb: 24576, processes: [{ pid: 1234, name: "trainer", vramMb: 18000 }] }
    ]);
  });

  it("returns null accelerator when the tooling is absent", () => {
    const features = parseProbeEvidence("--accel\naccel: unavailable\n");

    expect(features.accelerator).toBeNull();
  });

  it("returns nulls when the evidence block is empty", () => {
    const features = parseProbeEvidence("");

    expect(features).toEqual({ accelerator: null, artifacts: null, processOrigins: null, netShape: null });
  });

  it("tolerates non-numeric vram placeholders in compute app lines", () => {
    const features = parseProbeEvidence("--accel\nGPU-0001, NVIDIA T4, 0, 0, 15360\nGPU-0001, 1234, python3, [N/A]\n");

    expect(features.accelerator).toEqual([
      { name: "NVIDIA T4", utilPct: 0, memUsedMb: 0, memTotalMb: 15360, processes: [{ pid: 1234, name: "python3", vramMb: 0 }] }
    ]);
  });

  it("keeps commas in process names within one process entry", () => {
    const features = parseProbeEvidence("--accel\nGPU-0001, NVIDIA T4, 5, 100, 15360\nGPU-0001, 42, trainer, extra, part, 96\n");

    expect(features.accelerator).toEqual([
      { name: "NVIDIA T4", utilPct: 5, memUsedMb: 100, memTotalMb: 15360, processes: [{ pid: 42, name: "trainer, extra, part", vramMb: 96 }] }
    ]);
  });

  it("keeps spaces in artifact paths and process comm fields", () => {
    const features = parseProbeEvidence(
      ["--disk", "104857600 /root/My Folder/model file.bin", "--procorig", "btime=100", "7 ppid=1 starttime=50 comm=my worker", ""].join("\n")
    );

    expect(features.artifacts).toEqual([{ path: "/root/My Folder/model file.bin", sizeBytes: 104857600 }]);
    expect(features.processOrigins).toEqual([{ pid: 7, ppid: 1, comm: "my worker", startedAtEpochMs: 100500 }]);
  });

  it("decodes v4-mapped and native ipv6 remotes from netl lines", () => {
    const raw = [
      "--netl",
      "      1 listen=22",
      "      1 0016 0000000000000000FFFF00000100007F:01BB 01",
      "      2 0EA7 F804012A8F0B170C0000000002000000:0050 01",
      ""
    ].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.netShape?.listenPorts).toEqual([22]);
    expect(features.netShape?.connections).toEqual([
      { localPort: 22, remoteIp: "127.0.0.1", remotePort: 443, count: 1, state: "established" },
      { localPort: 3751, remoteIp: "2a01:04f8:0c17:0b8f:0000:0000:0000:0002", remotePort: 80, count: 2, state: "established" }
    ]);
  });

  it("merges duplicate netl keys into one counted entry", () => {
    const raw = ["--netl", "      2 0D05 140AB912:01BB 01", "      3 0D05 140AB912:01BB 01", ""].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.netShape?.connections).toEqual([{ localPort: 3333, remoteIp: "18.185.10.20", remotePort: 443, count: 5, state: "established" }]);
  });

  it("keeps a half open socket apart from a live one", () => {
    const raw = ["--netl", "      1 0D05 140AB912:01BB 01", "      1 0D06 140AB912:01BB 02", ""].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.netShape?.connections).toEqual([
      { localPort: 3333, remoteIp: "18.185.10.20", remotePort: 443, count: 1, state: "established" },
      { localPort: 3334, remoteIp: "18.185.10.20", remotePort: 443, count: 1, state: "connecting" }
    ]);
  });

  it("ignores malformed section lines instead of throwing", () => {
    const features = parseProbeEvidence(
      ["--accel", "not,a,gpu,line", "--disk", "notasize /path", "--procorig", "nonsense line", "--netl", "garbage", ""].join("\n")
    );

    expect(features.accelerator).toEqual([]);
    expect(features.artifacts).toEqual([]);
    expect(features.processOrigins).toEqual([]);
    expect(features.netShape).toEqual({ listenPorts: [], connections: [] });
  });

  it("reports zero startedAtEpochMs when the btime header is missing", () => {
    const features = parseProbeEvidence("--procorig\n999 ppid=1 starttime=100 comm=sh\n");

    expect(features.processOrigins).toEqual([{ pid: 999, ppid: 1, comm: "sh", startedAtEpochMs: 0 }]);
  });
});
