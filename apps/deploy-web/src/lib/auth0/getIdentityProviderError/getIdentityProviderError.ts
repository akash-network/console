import { CallbackHandlerError, IdentityProviderError } from "@src/lib/auth0";

export function getIdentityProviderError(error: unknown): IdentityProviderError | undefined {
  if (!(error instanceof CallbackHandlerError)) {
    return undefined;
  }

  return error.cause instanceof IdentityProviderError ? error.cause : undefined;
}
