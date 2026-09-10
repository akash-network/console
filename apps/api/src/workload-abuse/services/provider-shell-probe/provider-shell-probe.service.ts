import { singleton } from "tsyringe";

import { FILE_BODY_PREFIX } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import { ProviderStreamService, type ProviderStreamStatus } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

/** Collect-only and printf-only: argv is visible to the workload through /proc, and dash's echo expands the `\0` in this script's own cmdline into a NUL byte. */
export const SHELL_PROBE_COLLECTORS = [
  "echo '--loadavg'; cat /proc/loadavg 2>/dev/null",
  "echo '--nproc'; nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null",
  'echo \'--procs\'; T=$(command -v timeout >/dev/null 2>&1 && printf \'timeout 2\'); n=0; for p in /proc/[0-9]*; do [ "${p#/proc/}" = "$$" ] && continue; { read -r s < "$p/stat"; } 2>/dev/null || continue; m=${s#*(}; m=${m%)*}; set -- ${s##*) }; [ "${2:-}" = "$$" ] && continue; c=$({ $T tr \'\\0\' \' \' < "$p/cmdline"; } 2>/dev/null); [ -n "$c" ] || continue; printf \'%s\\n\' "${p#/proc/} cpu_s=$(( (${12:-0} + ${13:-0}) / 100 )) rss_mb=$(( ${22:-0} * 4 / 1024 )) comm=$m exe=$(readlink "$p/exe" 2>/dev/null) cwd=$(readlink "$p/cwd" 2>/dev/null) cmd=$c"; n=$((n + 1)); [ "$n" -ge 150 ] && break; done',
  'echo \'--net\'; for f in /proc/net/tcp /proc/net/tcp6; do [ -r "$f" ] || continue; while read -r sl la ra st rest; do case $st in 0A) printf \'listen=%d\\n\' "0x${la#*:}"; continue;; 01|02) ;; *) continue;; esac; h=${ra%:*}; po=${ra#*:}; case $h in 0000000000000000[Ff][Ff][Ff][Ff]0000????????|????????) ;; ????????????????????????????????) w=${h%????????????????????????}; t=${h#????????}; x=${t%????????????????}; t=${h#????????????????}; y=${t%????????}; z=${h#????????????????????????}; o=; for q in $w $x $y $z; do u=${q%????}; v=${q%??}; o=$o${q#??????}${v#????}:${u#??}${q%??????}:; done; printf \'st=%s remote=[%s]:%d\\n\' "$st" "${o%:}" "0x$po"; continue;; esac; h=${h#????????????????????????}; a=${h%??????}; b=${h%????}; b=${b#??}; c=${h%??}; c=${c#????}; d=${h#??????}; printf \'st=%s remote=%d.%d.%d.%d:%d\\n\' "$st" "0x$d" "0x$c" "0x$b" "0x$a" "0x$po"; done < "$f"; done 2>/dev/null | sort | uniq -c | head -80',
  "echo '--tmp'; ls -la /tmp /dev/shm 2>/dev/null | head -80",
  `echo '--files'; for f in /tmp/*.json /tmp/*.conf /tmp/*.txt /tmp/*/*.json /tmp/*/*.conf; do [ -f "$f" ] && [ "$(wc -c < "$f")" -lt 16384 ] && printf '%s\\n' "== $f" && while IFS= read -r l || [ -n "$l" ]; do printf '${FILE_BODY_PREFIX}%s\\n' "$l"; l=; done < "$f"; done 2>/dev/null | head -400`,
  "echo '--authorized-keys'; cat /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null | sort -u | head -10",
  "echo '--recent-exec'; find / \\( -path /proc -o -path /sys -o -path /dev -o -name node_modules \\) -prune -o -type f -perm -100 -newer /proc/1 -print 2>/dev/null | head -60 | while read -r f; do ls -la \"$f\" 2>/dev/null; done",
  `echo '--recent-conf'; find / \\( -path /proc -o -path /sys -o -path /dev -o -path /etc -o -path /tmp -o -name node_modules \\) -prune -o -type f -newer /proc/1 \\( -name '*.json' -o -name '*.conf' -o -name '*.ini' -o -name '*.txt' \\) -size -16k -print 2>/dev/null | head -20 | while read -r f; do printf '%s\\n' "== $f"; [ -r "$f" ] || continue; while IFS= read -r l || [ -n "$l" ]; do printf '${FILE_BODY_PREFIX}%s\\n' "$l"; l=; done < "$f"; done | head -400`
];

export const SHELL_PROBE_SCRIPT = SHELL_PROBE_COLLECTORS.join("; ");

export type ShellProbeStatus = ProviderStreamStatus | "shell_unavailable";

export type ShellProbeResult = { status: ShellProbeStatus; output: string; exitCode?: number };

export type ShellProbeTarget = {
  hostUri: string;
  providerAddress: string;
  token: string;
  dseq: string;
  gseq: number;
  oseq: number;
  service: string;
};

export function buildShellProbeUrl(target: ShellProbeTarget): string {
  const command = ["sh", "-c", SHELL_PROBE_SCRIPT].map((part, index) => `cmd${index}=${encodeURIComponent(part)}`).join("&");

  return `${target.hostUri}/lease/${target.dseq}/${target.gseq}/${target.oseq}/shell?stdin=0&tty=0&podIndex=0&${command}&service=${encodeURIComponent(target.service)}`;
}

@singleton()
export class ProviderShellProbeService {
  constructor(
    private readonly providerStreamService: ProviderStreamService,
    private readonly config: WorkloadAbuseConfigService
  ) {}

  async run(target: ShellProbeTarget): Promise<ShellProbeResult> {
    const result = await this.providerStreamService.collect({
      url: buildShellProbeUrl(target),
      providerAddress: target.providerAddress,
      token: target.token,
      idleTimeoutMs: this.config.get("WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS"),
      hardTimeoutMs: this.config.get("WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS"),
      maxBytes: this.config.get("WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES")
    });

    const output = result.frames
      .filter(frame => frame.kind === "shell" && (frame.stream === "stdout" || frame.stream === "stderr"))
      .map(frame => frame.payload)
      .join("");
    const failed = result.frames.some(frame => frame.kind === "shell" && frame.stream === "failure");
    const status: ShellProbeStatus = failed || (result.status === "completed" && output.length === 0) ? "shell_unavailable" : result.status;

    return { status, output, exitCode: result.exitCode };
  }
}
