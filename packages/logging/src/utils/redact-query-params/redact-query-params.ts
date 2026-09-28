const TYPES_THAT_CANNOT_HOLD_TEXT = new Set(["number", "bigint", "boolean", "undefined"]);

/** A bound parameter may carry a secret or user content, so only values that cannot hold text are logged. */
export function redactQueryParams(params: readonly unknown[]): string[] {
  return params.map(redactQueryParam);
}

function redactQueryParam(param: unknown): string {
  if (param === null || TYPES_THAT_CANNOT_HOLD_TEXT.has(typeof param)) return String(param);
  return `<redacted ${typeof param}>`;
}
