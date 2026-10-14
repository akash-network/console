import { isHttpError } from "@akashnetwork/http-sdk";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import type { QueryClient } from "@tanstack/react-query";

import { readActiveOrganizationCookie, serializeActiveOrganizationCookieRemoval } from "@src/lib/active-organization/active-organization-cookie";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/types/organization";

const FORBIDDEN_STATUS = 403;

export function isOrganizationForbiddenError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.status === FORBIDDEN_STATUS && extractApiErrorCode(error) === ORGANIZATION_FORBIDDEN_ERROR_CODE;
  }

  if (isHttpError<{ code?: unknown }>(error)) {
    return error.response?.status === FORBIDDEN_STATUS && error.response.data?.code === ORGANIZATION_FORBIDDEN_ERROR_CODE;
  }

  return false;
}

/** Drops an active organization the API refuses so it falls back to its own choice; subscribers reset what they hold for the dropped one. */
export class StaleOrganizationRecovery {
  static readonly #EVENT_TYPE = "stale-organization";
  readonly #target = new EventTarget();

  /** Acts only while the cookie is set, so an API that keeps refusing after the fallback cannot clear the cache in a loop. */
  recover(error: unknown, queryClient: QueryClient): boolean {
    if (typeof document === "undefined" || !isOrganizationForbiddenError(error) || !readActiveOrganizationCookie(document.cookie)) return false;

    document.cookie = serializeActiveOrganizationCookieRemoval();
    queryClient.clear();
    this.#target.dispatchEvent(new Event(StaleOrganizationRecovery.#EVENT_TYPE));
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.#target.addEventListener(StaleOrganizationRecovery.#EVENT_TYPE, listener);
    return () => {
      this.#target.removeEventListener(StaleOrganizationRecovery.#EVENT_TYPE, listener);
    };
  }
}
