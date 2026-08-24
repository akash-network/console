/**
 * Auth0's `ManagementClient` installs its own `parseError`, which throws `ManagementApiError` when the
 * error body is valid JSON and `ResponseError` when it is not. Neither class extends the other, so
 * matching on shape rather than on class keeps this working if the SDK introduces a third error type.
 */
export type Auth0ApiError = Error & { statusCode: number; body: string };

export function isAuth0ApiError(error: unknown): error is Auth0ApiError {
  return (
    error instanceof Error && typeof (error as Partial<Auth0ApiError>).statusCode === "number" && typeof (error as Partial<Auth0ApiError>).body === "string"
  );
}

/**
 * `ManagementApiError` already carries Auth0's message, but `ResponseError` sets a generic one and
 * keeps the detail in the raw body, so prefer the body's message whenever it parses.
 */
export function extractAuth0ErrorMessage(error: Auth0ApiError): string {
  try {
    return JSON.parse(error.body).message || error.message;
  } catch {
    return error.message;
  }
}
