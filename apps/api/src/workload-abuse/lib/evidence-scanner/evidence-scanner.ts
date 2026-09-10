import type { CompiledSignature, SignatureBucket } from "@src/workload-abuse/config/env.config";

export type EvidenceSourceKind = "sdl" | "logs" | "shell";

export type EvidenceSource = { kind: EvidenceSourceKind; service?: string; text: string };

export type DetectionSignal = { bucket: SignatureBucket; category: string; source: EvidenceSourceKind; service?: string; snippet: string };

export type WorkloadVerdict = "hard" | "soft" | "proxy" | "clean";

const MAX_SNIPPET_LENGTH = 180;
const SNIPPET_LEAD_IN = 60;
/** Any one soft category alone (a port number, the word nonce) shows up in honest workloads. */
const MIN_SOFT_CATEGORIES_FOR_VERDICT = 3;
const CONTROL_CHARACTERS_EXCEPT_TAB_AND_NEWLINE = /(?!\n|\t)\p{Cc}/gu;

/** One signal per category per source, so a chatty miner log produces an auditable table rather than thousands of rows. */
export function scanForSignals(sources: EvidenceSource[], signatures: CompiledSignature[]): DetectionSignal[] {
  const signals: DetectionSignal[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const service = source.service === undefined ? undefined : sanitizeEvidenceText(source.service);

    for (const line of source.text.split("\n")) {
      if (!line.trim()) continue;

      for (const signature of signatures) {
        const match = signature.pattern.exec(line);
        if (!match) continue;

        const key = `${signature.bucket}|${signature.category}|${source.kind}|${service ?? ""}`;
        if (seen.has(key)) continue;

        seen.add(key);
        signals.push({
          bucket: signature.bucket,
          category: signature.category,
          source: source.kind,
          service,
          snippet: toSnippet(line, match.index)
        });
      }
    }
  }

  return signals;
}

export function toVerdict(signals: DetectionSignal[]): WorkloadVerdict {
  if (signals.some(signal => signal.bucket === "hard")) return "hard";

  const softCategories = new Set(signals.filter(signal => signal.bucket === "soft").map(signal => signal.category));
  if (softCategories.size >= MIN_SOFT_CATEGORIES_FOR_VERDICT) return "soft";

  if (signals.some(signal => signal.bucket === "proxy")) return "proxy";

  return "clean";
}

function toSnippet(line: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_LEAD_IN);
  return sanitizeEvidenceText(line.slice(start, start + MAX_SNIPPET_LENGTH)).trim();
}

/** Postgres rejects NUL in text and jsonb and a log line escapes every other control byte to six characters, so a container's raw output loses them all. */
export function sanitizeEvidenceText(text: string): string {
  return text.replace(CONTROL_CHARACTERS_EXCEPT_TAB_AND_NEWLINE, " ");
}

/** The probe marks each file body line as it reads it, so a body line that reads like a section or a file header cannot pass for one here. */
export const FILE_BODY_PREFIX = "| ";

/** A clean deployment is somebody's app, and the config files the probe reads to find a pool can hold that app's own keys. */
export function withoutFileContents(excerpt: string): string {
  return excerpt
    .split("\n")
    .filter(line => !line.startsWith(FILE_BODY_PREFIX))
    .join("\n");
}
