import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { withoutFileContents } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import type { ProviderStreamResult, ProviderStreamService } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildShellProbeScript, buildShellProbeUrl, ProviderShellProbeService, SHELL_PROBE_COLLECTORS } from "./provider-shell-probe.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const TMP_FILE_GLOBS = "/tmp/*.json /tmp/*.conf /tmp/*.txt /tmp/*/*.json /tmp/*/*.conf";
const TARGET = { hostUri: "https://provider.example:8443", providerAddress: "akash1provider", token: "jwt", dseq: "123", gseq: 1, oseq: 2, service: "ssh box" };
const BOUNDARY = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const SCRIPT = buildShellProbeScript(BOUNDARY);

describe(ProviderShellProbeService.name, () => {
  describe("buildShellProbeUrl", () => {
    it("runs the collector script through sh without stdin or a tty on the first pod of the service", () => {
      const url = new URL(buildShellProbeUrl(TARGET, BOUNDARY));

      expect(url.origin + url.pathname).toBe("https://provider.example:8443/lease/123/1/2/shell");
      expect(url.searchParams.get("stdin")).toBe("0");
      expect(url.searchParams.get("tty")).toBe("0");
      expect(url.searchParams.get("podIndex")).toBe("0");
      expect(url.searchParams.get("cmd0")).toBe("sh");
      expect(url.searchParams.get("cmd1")).toBe("-c");
      expect(url.searchParams.get("cmd2")).toBe(SCRIPT);
      expect(url.searchParams.get("service")).toBe("ssh box");
    });

    it("prints expanded lines with printf so a dash echo cannot turn the script's own cmdline into NUL bytes", () => {
      expect(SCRIPT).toContain("printf '%s\\n' \"${p#/proc/} cpu_s=");
      expect(SCRIPT).toContain("printf '%s\\n' \"== $f\"");
      expect(SCRIPT).not.toMatch(/echo "/);
    });

    it("marks every file body line as it reads it, so no body line can pass for a section or a file header", () => {
      expect(SCRIPT).not.toMatch(/cat "\$f"/);
      expect(SCRIPT.match(/printf '\| %s\\n' "\$l"/g)).toHaveLength(2);
    });

    it("reads a whole stat file before parsing it, since a workload can put a newline in its own process name", () => {
      expect(SCRIPT).toContain('{ s=; while IFS= read -r x; do s="$s$x "; done < "$p/stat"; } 2>/dev/null; [ -n "$s" ] || continue');
    });

    it("streams the process listing line by line and bounds each cmdline read, so a hung or starved process still leaves the rest visible", () => {
      expect(SCRIPT).toContain("T=$(command -v timeout >/dev/null 2>&1 && printf 'timeout 2')");
      expect(SCRIPT).toContain("c=$({ $T tr '\\0' ' ' < \"$p/cmdline\"; } 2>/dev/null)");
      expect(SCRIPT).toContain('n=$((n + 1)); [ "$n" -ge 150 ] && break; done');
      expect(SCRIPT).not.toContain("head -150");
    });

    it("leaves its own shell and that shell's children out of the process listing by pid, not by what they run", () => {
      expect(SCRIPT).toContain('[ "${p#/proc/}" = "$$" ] && continue');
      expect(SCRIPT).toContain('[ "${2:-}" = "$$" ] && continue');
    });

    it("records cpu time and memory per process, listening ports, and files written since the container started", () => {
      expect(SCRIPT).toContain("cpu_s=$(( (${12:-0} + ${13:-0}) / 100 )) rss_mb=$(( ${22:-0} * 4 / 1024 ))");
      expect(SCRIPT).toContain("printf 'listen=%d\\n' \"0x${la#*:}\"");
      expect(SCRIPT).toContain(
        "echo '--recent-exec'; find / \\( -path /proc -o -path /sys -o -path /dev -o -name node_modules \\) -prune -o -type f -perm -100 -newer /proc/1 -print"
      );
      expect(SCRIPT).toContain(
        "echo '--recent-conf'; find / \\( -path /proc -o -path /sys -o -path /dev -o -path /etc -o -path /tmp -o -name node_modules \\) -prune"
      );
    });

    it("closes the collected sections with the boundary it was given, before the sections only the evidence table reads", () => {
      expect(SCRIPT).toContain(`echo '--evidence ${BOUNDARY}'`);
      expect(SCRIPT.indexOf(`--evidence ${BOUNDARY}`)).toBeLessThan(SCRIPT.indexOf("--accel"));
      expect(SCRIPT.indexOf("--recent-conf")).toBeLessThan(SCRIPT.indexOf(`--evidence ${BOUNDARY}`));
    });

    it("only reads the container and never changes, fetches or runs anything in it", () => {
      expect(SCRIPT).not.toMatch(/\b(curl|wget|chmod|chown|kill|rm|mv|cp|apt|apk|pip|npm)\b/);
      expect(SCRIPT).not.toMatch(/[^2<]>\s*\/(?!dev\/null)/);
    });
  });

  describe("the --procs collector", () => {
    it("reports the cpu time, memory, name and command line of each process it finds", () => {
      const reported = runProcsCollector([
        { pid: "9000001", comm: "xmrig", utimeTicks: 12_000, stimeTicks: 3_000, rssPages: 51_200, cmdline: ["xmrig", "-o", "pool.example:3333"] }
      ]);

      expect(reported).toEqual(["--procs", "9000001 cpu_s=150 rss_mb=200 comm=xmrig exe= cwd= cmd=xmrig -o pool.example:3333"]);
    });

    it("keeps a process name that has a closing parenthesis in it, since a workload picks its own name", () => {
      const reported = runProcsCollector([{ pid: "9000001", comm: "mine)r", utimeTicks: 100, stimeTicks: 0, rssPages: 256, cmdline: ["mine)r"] }]);

      expect(reported).toEqual(["--procs", "9000001 cpu_s=1 rss_mb=1 comm=mine)r exe= cwd= cmd=mine)r"]);
    });

    it("keeps the cpu time and memory of a process whose name contains a newline, since a workload names itself", () => {
      const reported = runProcsCollector([{ pid: "9000001", comm: "ev\nil", utimeTicks: 12_000, stimeTicks: 3_000, rssPages: 51_200, cmdline: ["miner"] }]);

      expect(reported).toEqual(["--procs", "9000001 cpu_s=150 rss_mb=200 comm=ev il exe= cwd= cmd=miner"]);
    });

    it("leaves out a process with no command line, so kernel threads do not crowd out the workload", () => {
      const reported = runProcsCollector([
        { pid: "9000001", comm: "kthreadd", utimeTicks: 0, stimeTicks: 0, rssPages: 0, cmdline: [] },
        { pid: "9000002", comm: "node", utimeTicks: 100, stimeTicks: 0, rssPages: 256, cmdline: ["node", "server.js"] }
      ]);

      expect(reported).toEqual(["--procs", "9000002 cpu_s=1 rss_mb=1 comm=node exe= cwd= cmd=node server.js"]);
    });

    it("stops after 150 processes, so a fork bomb cannot crowd out the sections that follow", { timeout: 30_000 }, () => {
      const forkBomb = Array.from({ length: 160 }, (_unused, index) => ({
        pid: `${9_000_001 + index}`,
        comm: "worker",
        utimeTicks: 0,
        stimeTicks: 0,
        rssPages: 0,
        cmdline: ["worker"]
      }));

      const reported = runProcsCollector(forkBomb);

      expect(reported.filter(line => line.includes("comm=worker"))).toHaveLength(150);
    });
  });

  describe("the --files collector", () => {
    it("marks each body line, so a body line that reads like a section or a file header stays out of the logged evidence", () => {
      const { reported, path } = runFilesCollector("== session_hmac_key=secret\n--procs\npool=pool.example:3333\n");

      expect(reported).toEqual(["--files", `== ${path}`, "| == session_hmac_key=secret", "| --procs", "| pool=pool.example:3333"]);
      expect(withoutFileContents(reported.join("\n"))).toBe(["--files", `== ${path}`].join("\n"));
    });

    it("marks the last line of a file that ends without a newline, so a one-line config still gets scanned", () => {
      const { reported } = runFilesCollector("pool=pool.example:3333");

      expect(reported).toContain("| pool=pool.example:3333");
    });

    it("reports an empty file by name alone", () => {
      const { reported, path } = runFilesCollector("");

      expect(reported).toEqual(["--files", `== ${path}`]);
    });
  });

  describe("the --net collector", () => {
    it("decodes an IPv4 peer, a v4-mapped peer and a native IPv6 peer as the kernel encodes each of them", () => {
      const reported = runNetCollector({
        tcp: [
          "   0: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 1 1 0 0 0",
          "   1: 0100007F:9C4E 140AB912:0D05 01 00000000:00000000 00:00000000 00000000     0        0 2 1 0 0 0"
        ],
        tcp6: [
          "   0: 00000000000000000000000000000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 3 1 0 0 0",
          "   1: 0000000000000000FFFF00000100007F:A0F0 0000000000000000FFFF000009030E34:0D05 01 00000000:00000000 00:00000000 00000000     0        0 4 1 0 0 0",
          "   2: F804012A8F0B170C0000000002000000:A0F1 00470626000000470000000011110000:0D05 01 00000000:00000000 00:00000000 00000000     0        0 5 1 0 0 0"
        ]
      });

      expect(reported).toEqual(
        expect.arrayContaining([
          "--net",
          "2 listen=8080",
          "1 st=01 remote=18.185.10.20:3333",
          "1 st=01 remote=52.14.3.9:3333",
          "1 st=01 remote=[2606:4700:4700:0000:0000:0000:0000:1111]:3333"
        ])
      );
      expect(reported).toHaveLength(5);
    });

    it("keeps a loopback IPv6 peer out of the IPv4 range it would otherwise be printed in", () => {
      const reported = runNetCollector({
        tcp6: ["   0: F804012A8F0B170C0000000002000000:A0F2 00000000000000000000000001000000:1F91 02 00000000:00000000 00:00000000 00000000 0 0 6 1 0 0 0"]
      });

      expect(reported).toEqual(["--net", "1 st=02 remote=[0000:0000:0000:0000:0000:0000:0000:0001]:8081"]);
    });

    it("leaves out a socket that is neither established nor listening", () => {
      const reported = runNetCollector({
        tcp: ["   0: 0100007F:9C4E 140AB912:0D05 06 00000000:00000000 00:00000000 00000000     0        0 7 1 0 0 0"]
      });

      expect(reported).toEqual(["--net"]);
    });
  });

  describe("the --accel collector", () => {
    it("reports the accelerator model, utilization and memory along with the processes holding it", () => {
      const binDirectory = mkdtempSync(join(tmpdir(), "shell-probe-accel-"));
      writeFileSync(
        join(binDirectory, "nvidia-smi"),
        [
          "#!/bin/sh",
          'case "$1" in',
          "  --query-gpu*) printf 'GPU-0001, NVIDIA A100, 95, 20480, 24576\\n' ;;",
          "  --query-compute-apps*) printf 'GPU-0001, 1234, python3, 18000\\n' ;;",
          "esac"
        ].join("\n"),
        { mode: 0o755 }
      );

      const reported = runCollector("--accel", collector => collector, { ...process.env, PATH: `${binDirectory}:${process.env.PATH}` });

      expect(reported).toEqual(["--accel", "GPU-0001, NVIDIA A100, 95, 20480, 24576", "GPU-0001, 1234, python3, 18000"]);
    });

    it("reports the accelerator as unavailable when the container has no nvidia-smi", () => {
      const binDirectory = mkdtempSync(join(tmpdir(), "shell-probe-accel-"));
      symlinkSync("/bin/sh", join(binDirectory, "sh"));

      const reported = runCollector("--accel", collector => collector, { PATH: binDirectory });

      expect(reported).toEqual(["--accel", "accel: unavailable"]);
    });
  });

  describe("the --netl collector", () => {
    it("reports the local port and remote endpoint of each connected socket, counted per peer", () => {
      const reported = runNetlCollector({
        tcp: [
          "   0: 0100007F:9C4E 140AB912:0D05 01 00000000:00000000 00:00000000 00000000     0        0 2 1 0 0 0",
          "   1: 0100007F:9C4E 140AB912:0D05 01 00000000:00000000 00:00000000 00000000     0        0 2 1 0 0 0",
          "   2: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 3 1 0 0 0"
        ],
        tcp6: [
          "   0: 0000000000000000FFFF00000100007F:A0F0 0000000000000000FFFF000009030E34:0D05 01 00000000:00000000 00:00000000 00000000     0        0 4 1 0 0 0"
        ]
      });

      expect(reported).toEqual(expect.arrayContaining(["2 9C4E 140AB912:0D05 01", "1 A0F0 0000000000000000FFFF000009030E34:0D05 01", "1 listen=8080"]));
      expect(reported).toHaveLength(4);
    });

    it("leaves out a socket that is neither established nor connecting", () => {
      const reported = runNetlCollector({
        tcp: ["   0: 0100007F:9C4E 140AB912:0D05 06 00000000:00000000 00:00000000 00000000     0        0 7 1 0 0 0"]
      });

      expect(reported).toEqual(["--netl"]);
    });
  });

  describe("the --disk collector", () => {
    it("reports the size and path of a file over 64 MiB and leaves smaller files out", () => {
      const directory = mkdtempSync(join(tmpdir(), "shell-probe-disk-"));
      writeFileSync(join(directory, "weights.bin"), "");
      truncateSync(join(directory, "weights.bin"), 70 * 1024 * 1024);
      writeFileSync(join(directory, "notes.txt"), "notes");

      const reported = runCollector("--disk", collector => collector.replace("find / -xdev", `find ${directory} -xdev`)).map(line => line.trim());

      expect(reported).toEqual(["--disk", `73400320 ${join(directory, "weights.bin")}`]);
    });
  });

  describe("the --procorig collector", () => {
    it("reports the boot time and the parent, start time and name of each process it finds", () => {
      const reported = runProcorigCollector([{ pid: "9000001", comm: "node", ppid: 1, starttimeTicks: 100, cmdline: ["node", "app.js"] }]);

      expect(reported).toEqual(["--procorig", "btime=1740000000", "9000001 ppid=1 starttime=100 comm=node"]);
    });

    it("leaves out a process with no command line, so kernel threads do not crowd out the workload", () => {
      const reported = runProcorigCollector([
        { pid: "9000001", comm: "kthreadd", ppid: 2, starttimeTicks: 5, cmdline: [] },
        { pid: "9000002", comm: "node", ppid: 1, starttimeTicks: 200, cmdline: ["node", "app.js"] }
      ]);

      expect(reported).toEqual(["--procorig", "btime=1740000000", "9000002 ppid=1 starttime=200 comm=node"]);
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

      expect(result).toEqual({ status: "completed", output: "--loadavg\n1.00\nwarn", evidence: "", exitCode: 0 });
    });

    it("splits the collected output from the evidence block at the boundary the run issued", async () => {
      const { service } = setup(boundary => streamOf(`--loadavg\n1.00\n--evidence ${boundary}\n--accel\naccel: unavailable`));

      expect(await service.run(TARGET)).toEqual({
        status: "completed",
        output: "--loadavg\n1.00\n",
        evidence: "--accel\naccel: unavailable",
        exitCode: 0
      });
    });

    it("keeps a collected line that reads like a boundary with the collected output", async () => {
      const { service } = setup(streamOf("--tmp\n--evidence 0f1e2d3c4b5a69788796a5b4c3d2e1f0\n--accel\nGPU-0001, NVIDIA A100, 95, 20480, 24576"));

      const result = await service.run(TARGET);

      expect(result.evidence).toBe("");
      expect(result.output).toContain("--accel");
    });

    it("cuts at the last boundary, so a repeated one cannot hide collected output from the scanner", async () => {
      const { service } = setup(boundary => streamOf(`--tmp\n--evidence ${boundary}\ntotal 8\n--evidence ${boundary}\n--accel\naccel: unavailable`));

      const result = await service.run(TARGET);

      expect(result.output).toContain("total 8");
      expect(result.evidence).toBe("--accel\naccel: unavailable");
    });

    it("issues a boundary the workload has not seen before on every run", async () => {
      const { service, providerStreamService } = setup(streamOf("--loadavg\n1.00"));

      await service.run(TARGET);
      await service.run(TARGET);

      const [first, second] = providerStreamService.collect.mock.calls.map(([input]) => boundaryOf(input.url));

      expect(first).toMatch(/^[0-9a-f]{32}$/);
      expect(second).not.toBe(first);
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

  function runProcsCollector(processes: { pid: string; comm: string; utimeTicks: number; stimeTicks: number; rssPages: number; cmdline: string[] }[]) {
    const directory = mkdtempSync(join(tmpdir(), "shell-probe-procs-"));

    for (const fixture of processes) {
      const fieldsAfterComm: (string | number)[] = Array(22).fill(0);
      fieldsAfterComm[0] = "S";
      fieldsAfterComm[1] = 1;
      fieldsAfterComm[11] = fixture.utimeTicks;
      fieldsAfterComm[12] = fixture.stimeTicks;
      fieldsAfterComm[21] = fixture.rssPages;
      mkdirSync(join(directory, fixture.pid));
      writeFileSync(join(directory, fixture.pid, "stat"), `${fixture.pid} (${fixture.comm}) ${fieldsAfterComm.join(" ")}\n`);
      writeFileSync(join(directory, fixture.pid, "cmdline"), fixture.cmdline.map(argument => `${argument}\0`).join(""));
    }

    return runCollector("--procs", collector => collector.replaceAll("/proc/", `${directory}/`));
  }

  function runFilesCollector(body: string) {
    const directory = mkdtempSync(join(tmpdir(), "shell-probe-files-"));
    const path = join(directory, "app.conf");
    writeFileSync(path, body);

    return { reported: runCollector("--files", collector => collector.replace(TMP_FILE_GLOBS, `${directory}/*.conf`)), path };
  }

  function runCollector(section: string, toRunnable: (collector: string) => string, env?: NodeJS.ProcessEnv) {
    const collector = SHELL_PROBE_COLLECTORS.find(entry => entry.includes(section)) ?? "";
    const { stdout } = spawnSync("sh", ["-c", toRunnable(collector)], { encoding: "utf8", env });

    return stdout
      .split("\n")
      .filter(line => line.trim())
      .map(line => line.trimEnd());
  }

  function runNetCollector(procFiles: { tcp?: string[]; tcp6?: string[] }) {
    const header = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";
    const directory = mkdtempSync(join(tmpdir(), "shell-probe-net-"));

    for (const name of ["tcp", "tcp6"] as const) {
      writeFileSync(join(directory, name), [header, ...(procFiles[name] ?? [])].join("\n") + "\n");
    }

    return runCollector("--net", collector => collector.replace("/proc/net/tcp /proc/net/tcp6", `${directory}/tcp ${directory}/tcp6`)).map(line => line.trim());
  }

  function runNetlCollector(procFiles: { tcp?: string[]; tcp6?: string[] }) {
    const header = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";
    const directory = mkdtempSync(join(tmpdir(), "shell-probe-netl-"));

    for (const name of ["tcp", "tcp6"] as const) {
      writeFileSync(join(directory, name), [header, ...(procFiles[name] ?? [])].join("\n") + "\n");
    }

    return runCollector("--netl", collector => collector.replace("/proc/net/tcp /proc/net/tcp6", `${directory}/tcp ${directory}/tcp6`)).map(line =>
      line.trim()
    );
  }

  function runProcorigCollector(processes: { pid: string; comm: string; ppid: number; starttimeTicks: number; cmdline: string[] }[]) {
    const directory = mkdtempSync(join(tmpdir(), "shell-probe-procorig-"));
    writeFileSync(join(directory, "stat"), "btime 1740000000\n");

    for (const fixture of processes) {
      const fieldsAfterComm: (string | number)[] = Array(22).fill(0);
      fieldsAfterComm[0] = "S";
      fieldsAfterComm[1] = fixture.ppid;
      fieldsAfterComm[19] = fixture.starttimeTicks;
      mkdirSync(join(directory, fixture.pid));
      writeFileSync(join(directory, fixture.pid, "stat"), `${fixture.pid} (${fixture.comm}) ${fieldsAfterComm.join(" ")}\n`);
      writeFileSync(join(directory, fixture.pid, "cmdline"), fixture.cmdline.map(argument => `${argument}\0`).join(""));
    }

    return runCollector("--procorig", collector => collector.replaceAll("/proc/", `${directory}/`));
  }

  function streamOf(payload: string): ProviderStreamResult {
    return { status: "completed", exitCode: 0, frames: [{ kind: "shell", stream: "stdout", payload }] };
  }

  function boundaryOf(url: string): string {
    const script = new URL(url).searchParams.get("cmd2") ?? "";

    return script.match(/--evidence ([0-9a-f]+)/)?.[1] ?? "";
  }

  function setup(result: ProviderStreamResult | ((boundary: string) => ProviderStreamResult)) {
    const providerStreamService = mock<ProviderStreamService>();
    providerStreamService.collect.mockImplementation(async input => (typeof result === "function" ? result(boundaryOf(input.url)) : result));
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS: 5_000,
      WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS: 30_000,
      WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES: 65_536
    });
    const service = new ProviderShellProbeService(providerStreamService, config);

    return { service, providerStreamService };
  }
});
