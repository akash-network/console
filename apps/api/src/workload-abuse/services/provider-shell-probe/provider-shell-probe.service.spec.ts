import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { withoutFileContents } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import type { ProviderStreamResult, ProviderStreamService } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildShellProbeUrl, ProviderShellProbeService, SHELL_PROBE_COLLECTORS, SHELL_PROBE_SCRIPT } from "./provider-shell-probe.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const TMP_FILE_GLOBS = "/tmp/*.json /tmp/*.conf /tmp/*.txt /tmp/*/*.json /tmp/*/*.conf";
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
      expect(SHELL_PROBE_SCRIPT).toContain("printf '%s\\n' \"${p#/proc/} cpu_s=");
      expect(SHELL_PROBE_SCRIPT).toContain("printf '%s\\n' \"== $f\"");
      expect(SHELL_PROBE_SCRIPT).not.toMatch(/echo "/);
    });

    it("marks every file body line as it reads it, so no body line can pass for a section or a file header", () => {
      expect(SHELL_PROBE_SCRIPT).not.toMatch(/cat "\$f"/);
      expect(SHELL_PROBE_SCRIPT.match(/printf '\| %s\\n' "\$l"/g)).toHaveLength(2);
    });

    it("streams the process listing line by line and bounds each cmdline read, so a hung or starved process still leaves the rest visible", () => {
      expect(SHELL_PROBE_SCRIPT).toContain("T=$(command -v timeout >/dev/null 2>&1 && printf 'timeout 2')");
      expect(SHELL_PROBE_SCRIPT).toContain("c=$({ $T tr '\\0' ' ' < \"$p/cmdline\"; } 2>/dev/null)");
      expect(SHELL_PROBE_SCRIPT).toContain('n=$((n + 1)); [ "$n" -ge 150 ] && break; done');
      expect(SHELL_PROBE_SCRIPT).not.toContain("head -150");
    });

    it("leaves its own shell and that shell's children out of the process listing by pid, not by what they run", () => {
      expect(SHELL_PROBE_SCRIPT).toContain('[ "${p#/proc/}" = "$$" ] && continue');
      expect(SHELL_PROBE_SCRIPT).toContain('[ "${2:-}" = "$$" ] && continue');
    });

    it("records cpu time and memory per process, listening ports, and files written since the container started", () => {
      expect(SHELL_PROBE_SCRIPT).toContain("cpu_s=$(( (${12:-0} + ${13:-0}) / 100 )) rss_mb=$(( ${22:-0} * 4 / 1024 ))");
      expect(SHELL_PROBE_SCRIPT).toContain("printf 'listen=%d\\n' \"0x${la#*:}\"");
      expect(SHELL_PROBE_SCRIPT).toContain(
        "echo '--recent-exec'; find / \\( -path /proc -o -path /sys -o -path /dev -o -name node_modules \\) -prune -o -type f -perm -100 -newer /proc/1 -print"
      );
      expect(SHELL_PROBE_SCRIPT).toContain(
        "echo '--recent-conf'; find / \\( -path /proc -o -path /sys -o -path /dev -o -path /etc -o -path /tmp -o -name node_modules \\) -prune"
      );
    });

    it("only reads the container and never changes, fetches or runs anything in it", () => {
      expect(SHELL_PROBE_SCRIPT).not.toMatch(/\b(curl|wget|chmod|chown|kill|rm|mv|cp|apt|apk|pip|npm)\b/);
      expect(SHELL_PROBE_SCRIPT).not.toMatch(/[^2<]>\s*\/(?!dev\/null)/);
    });
  });

  describe("the --procs collector", () => {
    it("reports the cpu time, memory, name and command line of each process it finds", () => {
      const reported = runProcsCollector([
        { pid: "9000001", comm: "xmrig", utimeTicks: 12_000, stimeTicks: 3_000, rssPages: 51_200, cmdline: ["xmrig", "-o", "pool.example:3333"] }
      ]);

      expect(reported).toEqual(["--procs", "9000001 cpu_s=150 rss_mb=200 comm=xmrig exe= cwd= cmd=xmrig -o pool.example:3333"]);
    });

    it("leaves out a process with no command line, so kernel threads do not crowd out the workload", () => {
      const reported = runProcsCollector([
        { pid: "9000001", comm: "kthreadd", utimeTicks: 0, stimeTicks: 0, rssPages: 0, cmdline: [] },
        { pid: "9000002", comm: "node", utimeTicks: 100, stimeTicks: 0, rssPages: 256, cmdline: ["node", "server.js"] }
      ]);

      expect(reported).toEqual(["--procs", "9000002 cpu_s=1 rss_mb=1 comm=node exe= cwd= cmd=node server.js"]);
    });

    it("stops after 150 processes, so a fork bomb cannot crowd out the sections that follow", () => {
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

  function runCollector(section: string, toRunnable: (collector: string) => string) {
    const collector = SHELL_PROBE_COLLECTORS.find(entry => entry.includes(section)) ?? "";
    const { stdout } = spawnSync("sh", ["-c", toRunnable(collector)], { encoding: "utf8" });

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
