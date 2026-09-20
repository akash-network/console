import { describe, expect, it } from "vitest";

import { parseProbeEvidence, withoutEvidenceSections } from "./parse-probe-evidence";

describe("parseProbeEvidence", () => {
  it("parses accelerator, processes, artifacts, process origins, and net shape from full probe output", () => {
    const raw = [
      "--loadavg",
      "0.52 0.58 0.59 1/902 12345",
      "--nproc",
      "4",
      "--procs",
      "999 cpu_s=12 rss_mb=512 comm=python3 exe=/usr/bin/python3 cwd=/ app.py",
      "--net",
      "      2 listen=8080",
      "      3 st=01 remote=18.185.10.20:443",
      "--tmp",
      "total 8",
      "--files",
      "== /tmp/app.conf",
      "| key=value",
      "--authorized-keys",
      "--recent-exec",
      "/usr/bin/python3",
      "--recent-conf",
      "/home/user/app.ini",
      "--accel",
      "NVIDIA T4, 95, 15130, 15360",
      "1234, python3, 15100",
      "--netl",
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
      established: [{ localPort: 3333, remoteIp: "18.185.10.20", remotePort: 443, count: 3 }]
    });
  });

  it("returns null accelerator when the tooling is absent", () => {
    const features = parseProbeEvidence("--accel\naccel: unavailable\n");

    expect(features.accelerator).toBeNull();
  });

  it("returns nulls when no evidence sections are present", () => {
    const features = parseProbeEvidence("--loadavg\n0.10 0.20 0.30 1/900 1\n--nproc\n2\n");

    expect(features).toEqual({ accelerator: null, artifacts: null, processOrigins: null, netShape: null });
  });

  it("tolerates non-numeric vram placeholders in compute app lines", () => {
    const features = parseProbeEvidence("--accel\nNVIDIA T4, 0, 0, 15360\n1234, python3, [N/A]\n");

    expect(features.accelerator).toEqual([
      { name: "NVIDIA T4", utilPct: 0, memUsedMb: 0, memTotalMb: 15360, processes: [{ pid: 1234, name: "python3", vramMb: 0 }] }
    ]);
  });

  it("keeps commas in process names within one process entry", () => {
    const features = parseProbeEvidence("--accel\nNVIDIA T4, 5, 100, 15360\n42, trainer, extra, part, 96\n");

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
      "--net",
      "      1 listen=22",
      "--netl",
      "      1 0016 0000000000000000FFFF00000100007F:01BB 01",
      "      2 0EA7 F804012A8F0B170C0000000002000000:0050 01",
      ""
    ].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.netShape?.listenPorts).toEqual([22]);
    expect(features.netShape?.established).toEqual([
      { localPort: 22, remoteIp: "127.0.0.1", remotePort: 443, count: 1 },
      { localPort: 3751, remoteIp: "2a01:04f8:0c17:0b8f:0000:0000:0000:0002", remotePort: 80, count: 2 }
    ]);
  });

  it("merges duplicate netl keys into one counted entry", () => {
    const raw = ["--netl", "      2 0D05 140AB912:01BB 01", "      3 0D05 140AB912:01BB 01", ""].join("\n");

    const features = parseProbeEvidence(raw);

    expect(features.netShape?.established).toEqual([{ localPort: 3333, remoteIp: "18.185.10.20", remotePort: 443, count: 5 }]);
  });

  it("ignores malformed section lines instead of throwing", () => {
    const features = parseProbeEvidence(
      ["--accel", "not,a,gpu,line", "--disk", "notasize /path", "--procorig", "nonsense line", "--netl", "garbage", ""].join("\n")
    );

    expect(features.accelerator).toEqual([]);
    expect(features.artifacts).toEqual([]);
    expect(features.processOrigins).toEqual([]);
    expect(features.netShape).toEqual({ listenPorts: [], established: [] });
  });

  it("reports zero startedAtEpochMs when the btime header is missing", () => {
    const features = parseProbeEvidence("--procorig\n999 ppid=1 starttime=100 comm=sh\n");

    expect(features.processOrigins).toEqual([{ pid: 999, ppid: 1, comm: "sh", startedAtEpochMs: 0 }]);
  });
});

describe("withoutEvidenceSections", () => {
  it("strips everything from the first --accel marker onward", () => {
    const legacy = ["--loadavg", "0.10", "--nproc", "2"].join("\n") + "\n";
    const evidence = ["--accel", "NVIDIA T4, 1, 2, 3", "--netl", "  1 0D05 140AB912:01BB 01", "--disk", "1 /x", "--procorig", "btime=1"].join("\n") + "\n";

    expect(withoutEvidenceSections(legacy + evidence)).toBe(legacy);
  });

  it("returns empty output when --accel opens the output", () => {
    expect(withoutEvidenceSections("--accel\nNVIDIA T4, 1, 2, 3\n")).toBe("");
  });

  it("returns the output unchanged when no evidence markers exist", () => {
    const legacyOnly = "--loadavg\n0.10\n--nproc\n2\n";

    expect(withoutEvidenceSections(legacyOnly)).toBe(legacyOnly);
  });
});
