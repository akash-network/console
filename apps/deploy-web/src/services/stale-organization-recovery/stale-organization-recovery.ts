import { isHttpError } from "@akashnetwork/http-sdk";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import type { QueryClient } from "@tanstack/react-query";

import { readActiveOrganizationCookie, serializeActiveOrganizationCookieRemoval } from "@src/lib/active-organization/active-organization-cookie";
import type { TabOrganization } from "@src/services/tab-organization/tab-organization";
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

/** A call an earlier recovery or switch dropped named an organization the tab already left, so its refusal needs no new recovery. */
type RefusedCall = { isDropped: boolean };

/** Drops an organization the API refuses for this tab so the tab falls back to the cookie or the API's choice; subscribers reset what they hold for it. */
export class StaleOrganizationRecovery {
  static readonly #EVENT_TYPE = "stale-organization";
  readonly #target = new EventTarget();
  readonly #tabOrganization: TabOrganization;

  constructor(tabOrganization: TabOrganization) {
    this.#tabOrganization = tabOrganization;
  }

  /** Acts only while the tab or the cookie names an organization, so an API that keeps refusing after the fallback cannot clear the cache in a loop. */
  recover(error: unknown, queryClient: QueryClient, call: RefusedCall): boolean {
    if (typeof document === "undefined" || !isOrganizationForbiddenError(error)) return false;
    if (call.isDropped) return true;

    const cookieOrganizationId = readActiveOrganizationCookie(document.cookie);
    const refusedOrganizationId = this.#tabOrganization.organizationId ?? cookieOrganizationId;
    if (!refusedOrganizationId) return false;

    this.#tabOrganization.show(undefined);
    if (cookieOrganizationId === refusedOrganizationId) document.cookie = serializeActiveOrganizationCookieRemoval();
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
