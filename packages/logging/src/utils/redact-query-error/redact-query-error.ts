import { redactQueryParams } from "../redact-query-params/redact-query-params";

type FailedQueryError = Error & { query: string; params: unknown[] };
type DriverError = Error & { code?: unknown };

/** A failed query's message lists every bound parameter and Postgres puts row values in its error's detail, so neither survives the rebuild. */
export function redactQueryError<T>(error: T): T | Error {
  if (!isFailedQueryError(error)) return error;

  const params = redactQueryParams(error.params).join(", ");
  const redacted = Object.assign(copyError(error, `Failed query: ${error.query}\nparams: ${params}`), { query: error.query });
  if (error.cause instanceof Error) redacted.cause = copyDriverError(error.cause, error.params);

  return redacted;
}

function isFailedQueryError(error: unknown): error is FailedQueryError {
  return error instanceof Error && "query" in error && typeof error.query === "string" && "params" in error && Array.isArray(error.params);
}

function copyDriverError(error: DriverError, params: unknown[]): DriverError {
  const copy = copyError(error, redactQuotedParams(error.message, params));
  return error.code === undefined ? copy : Object.assign(copy, { code: error.code });
}

/** Postgres quotes a value it cannot accept in its error message, so a bound parameter can reappear there. */
function redactQuotedParams(message: string, params: unknown[]): string {
  const redactions = redactQueryParams(params);
  return params.reduce<string>((redacted, param, index) => redacted.replaceAll(`"${String(param)}"`, `"${redactions[index]}"`), message);
}

function copyError(error: Error, message: string): Error {
  const copy = new Error(message);
  copy.name = error.name;
  copy.stack = error.stack?.replace(error.message, () => message);
  return copy;
}
