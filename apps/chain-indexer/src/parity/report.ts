export type CheckStatus = "pass" | "fail" | "skipped";

export interface Mismatch {
  subject: string;
  expected: unknown;
  actual: unknown;
}

export interface CheckResult {
  name: string;
  status: CheckStatus;
  summary: string;
  mismatches: Mismatch[];
}

export interface ParityCheck {
  readonly name: string;
  run(): Promise<CheckResult>;
}

export interface ParityReport {
  ranAt: string;
  ok: boolean;
  results: CheckResult[];
}

/** Keeps a report readable when a check finds thousands of differences; the count still says how many there were. */
export const MAX_MISMATCHES_PER_CHECK = 50;

export function buildReport(results: CheckResult[], ranAt: Date): ParityReport {
  return { ranAt: ranAt.toISOString(), ok: results.every(result => result.status !== "fail"), results };
}

export function formatReport(report: ParityReport): string {
  const lines = [`Parity report ${report.ranAt}: ${report.ok ? "PASS" : "FAIL"}`];
  for (const result of report.results) {
    lines.push(`- [${result.status.toUpperCase()}] ${result.name}: ${result.summary}`);
    for (const mismatch of result.mismatches.slice(0, MAX_MISMATCHES_PER_CHECK)) {
      lines.push(`    ${mismatch.subject}: expected ${JSON.stringify(mismatch.expected)}, actual ${JSON.stringify(mismatch.actual)}`);
    }
  }
  return lines.join("\n");
}

export function skippedCheck(name: string, reason: string): ParityCheck {
  return { name, run: async () => ({ name, status: "skipped", summary: reason, mismatches: [] }) };
}

/** A check that throws while being built or run still yields a result, so one unreachable dependency fails its own line instead of hiding the whole report. */
export async function runCheck(name: string, build: () => ParityCheck): Promise<CheckResult> {
  try {
    return await build().run();
  } catch (error) {
    return { name, status: "fail", summary: `threw: ${error instanceof Error ? error.message : String(error)}`, mismatches: [] };
  }
}
