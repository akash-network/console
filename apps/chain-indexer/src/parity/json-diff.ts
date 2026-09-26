import type { Mismatch } from "@src/parity/report";

/** Structural diff of two JSON values; every leaf that differs becomes one mismatch keyed by its path under `subject`. */
export function diffJson(expected: unknown, actual: unknown, subject = "$"): Mismatch[] {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const mismatches: Mismatch[] = [];
    if (expected.length !== actual.length) {
      mismatches.push({ subject: `${subject}.length`, expected: expected.length, actual: actual.length });
    }
    const shared = Math.min(expected.length, actual.length);
    for (let index = 0; index < shared; index++) {
      mismatches.push(...diffJson(expected[index], actual[index], `${subject}[${index}]`));
    }
    return mismatches;
  }

  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap(key => diffJson(expected[key], actual[key], `${subject}.${key}`));
  }

  return Object.is(expected, actual) ? [] : [{ subject, expected, actual }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
