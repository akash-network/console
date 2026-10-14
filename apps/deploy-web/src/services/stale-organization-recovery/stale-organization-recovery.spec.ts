import { ApiError } from "@akashnetwork/openapi-sdk";
import { QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";

import { ACTIVE_ORGANIZATION_COOKIE_NAME } from "@src/lib/active-organization/active-organization-cookie";
import { isOrganizationForbiddenError, StaleOrganizationRecovery } from "./stale-organization-recovery";

describe(StaleOrganizationRecovery.name, () => {
  describe("recover", () => {
    it("drops the organization cookie and the cached data when the API refuses the organization", () => {
      const { recovery, queryClient, listener } = setup();

      const isRecovered = recovery.recover(forbiddenError(), queryClient);

      expect(isRecovered).toBe(true);
      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("recognises the refusal from the axios based services too", () => {
      const { recovery, queryClient } = setup();
      const error = new AxiosError("Forbidden", "403", undefined, undefined, {
        status: 403,
        statusText: "Forbidden",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { code: "organization_forbidden" }
      });

      expect(recovery.recover(error, queryClient)).toBe(true);
      expect(queryClient.clear).toHaveBeenCalledOnce();
    });

    it("acts once when the API keeps refusing after the fallback", () => {
      const { recovery, queryClient, listener } = setup();

      recovery.recover(forbiddenError(), queryClient);
      const isRecoveredAgain = recovery.recover(forbiddenError(), queryClient);

      expect(isRecoveredAgain).toBe(false);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("leaves the organization alone for any other refusal", () => {
      const { recovery, queryClient, listener } = setup();

      expect(recovery.recover(new ApiError(403, { code: "owner_role_restricted" }, "POST → 403"), queryClient)).toBe(false);
      expect(recovery.recover(new ApiError(404, { code: "organization_forbidden" }, "GET → 404"), queryClient)).toBe(false);
      expect(recovery.recover(new Error("Failed to fetch"), queryClient)).toBe(false);
      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale`);
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subscribe", () => {
    it("stops notifying a listener that unsubscribed", () => {
      const { recovery, queryClient, listener, unsubscribe } = setup();

      unsubscribe();
      recovery.recover(forbiddenError(), queryClient);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe(isOrganizationForbiddenError.name, () => {
    it("requires both the forbidden status and the organization error code", () => {
      expect(isOrganizationForbiddenError(new ApiError(403, { code: "organization_forbidden" }, "→ 403"))).toBe(true);
      expect(isOrganizationForbiddenError(new ApiError(403, { code: "other" }, "→ 403"))).toBe(false);
      expect(isOrganizationForbiddenError(new ApiError(403, "forbidden", "→ 403"))).toBe(false);
      expect(isOrganizationForbiddenError(undefined)).toBe(false);
    });
  });

  function forbiddenError() {
    return new ApiError(403, { code: "organization_forbidden" }, "GET /v1/deployments → 403");
  }

  function setup() {
    document.cookie = `${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale; path=/`;
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "clear");
    const recovery = new StaleOrganizationRecovery();
    const listener = vi.fn();
    const unsubscribe = recovery.subscribe(listener);

    return { recovery, queryClient, listener, unsubscribe };
  }
});
