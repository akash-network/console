import { AccessTokenError, AccessTokenErrorCode } from "@src/lib/auth0";

const INVALID_SESSION_CODES: string[] = [AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN, AccessTokenErrorCode.FAILED_REFRESH_GRANT];

export function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof AccessTokenError)) {
    return false;
  }

  return INVALID_SESSION_CODES.includes(error.code);
}
