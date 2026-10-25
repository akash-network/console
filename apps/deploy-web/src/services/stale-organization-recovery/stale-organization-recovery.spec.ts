import { ApiError } from "@akashnetwork/openapi-sdk";
import { QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";

import { ACTIVE_ORGANIZATION_COOKIE_NAME } from "@src/lib/active-organization/active-organization-cookie";
import { TabOrganization } from "@src/services/tab-organization/tab-organization";
import { isOrganizationForbiddenError, StaleOrganizationRecovery } from "./stale-organization-recovery";

describe(StaleOrganizationRecovery.name, () => {
  describe("recover", () => {
    it("drops the organization cookie and the cached data when the API refuses the organization", () => {
      const { recovery, queryClient, listener } = setup({});

      const isRecovered = recovery.recover(forbiddenError(), queryClient, CURRENT_CALL);

      expect(isRecovered).toBe(true);
      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledExactlyOnceWith("org-stale");
    });

    it("drops the organization the tab shows and keeps the one another tab picked last", () => {
      const { recovery, queryClient, listener, tabOrganization } = setup({ tabOrganizationId: "org-shown", cookieOrganizationId: "org-picked" });

      const isRecovered = recovery.recover(forbiddenError(), queryClient, CURRENT_CALL);

      expect(isRecovered).toBe(true);
      expect(tabOrganization.organizationId).toBeUndefined();
      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-picked`);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledExactlyOnceWith("org-shown");
    });

    it("drops the cookie too when it names the organization the tab shows", () => {
      const { recovery, queryClient, tabOrganization } = setup({ tabOrganizationId: "org-stale" });

      expect(recovery.recover(forbiddenError(), queryClient, CURRENT_CALL)).toBe(true);
      expect(tabOrganization.organizationId).toBeUndefined();
      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
    });

    it("acts while the tab names an organization even without a cookie", () => {
      const { recovery, queryClient, listener } = setup({ tabOrganizationId: "org-shown", cookieOrganizationId: undefined });

      expect(recovery.recover(forbiddenError(), queryClient, CURRENT_CALL)).toBe(true);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("counts the refusal of a call an earlier recovery dropped as handled without acting again", () => {
      const { recovery, queryClient, listener, tabOrganization } = setup({ tabOrganizationId: "org-shown", cookieOrganizationId: "org-picked" });

      const isRecovered = recovery.recover(forbiddenError(), queryClient, { isDropped: true });

      expect(isRecovered).toBe(true);
      expect(tabOrganization.organizationId).toBe("org-shown");
      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-picked`);
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it("leaves a dropped call failing for another reason to the caller", () => {
      const { recovery, queryClient } = setup({});

      expect(recovery.recover(new ApiError(500, { code: "internal" }, "GET → 500"), queryClient, { isDropped: true })).toBe(false);
    });

    it("does nothing outside the browser", () => {
      const { recovery, queryClient, listener } = setup({ tabOrganizationId: "org-shown" });
      vi.stubGlobal("document", undefined);

      try {
        expect(recovery.recover(forbiddenError(), queryClient, CURRENT_CALL)).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it("recognises the refusal from the axios based services too", () => {
      const { recovery, queryClient } = setup({});
      const error = new AxiosError("Forbidden", "403", undefined, undefined, {
        status: 403,
        statusText: "Forbidden",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { code: "organization_forbidden" }
      });

      expect(recovery.recover(error, queryClient, CURRENT_CALL)).toBe(true);
      expect(queryClient.clear).toHaveBeenCalledOnce();
    });

    it("acts once when the API keeps refusing after the fallback", () => {
      const { recovery, queryClient, listener } = setup({});

      recovery.recover(forbiddenError(), queryClient, CURRENT_CALL);
      const isRecoveredAgain = recovery.recover(forbiddenError(), queryClient, CURRENT_CALL);

      expect(isRecoveredAgain).toBe(false);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("leaves the organization alone for any other refusal", () => {
      const { recovery, queryClient, listener, tabOrganization } = setup({ tabOrganizationId: "org-shown" });

      expect(recovery.recover(new ApiError(403, { code: "owner_role_restricted" }, "POST → 403"), queryClient, CURRENT_CALL)).toBe(false);
      expect(recovery.recover(new ApiError(404, { code: "organization_forbidden" }, "GET → 404"), queryClient, CURRENT_CALL)).toBe(false);
      expect(recovery.recover(new Error("Failed to fetch"), queryClient, CURRENT_CALL)).toBe(false);
      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale`);
      expect(tabOrganization.organizationId).toBe("org-shown");
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subscribe", () => {
    it("stops notifying a listener that unsubscribed", () => {
      const { recovery, queryClient, listener, unsubscribe } = setup({});

      unsubscribe();
      recovery.recover(forbiddenError(), queryClient, CURRENT_CALL);

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

  const CURRENT_CALL = { isDropped: false };

  function forbiddenError() {
    return new ApiError(403, { code: "organization_forbidden" }, "GET /v1/deployments → 403");
  }

  function setup(input: { tabOrganizationId?: string; cookieOrganizationId?: string }) {
    const cookieOrganizationId = "cookieOrganizationId" in input ? input.cookieOrganizationId : "org-stale";
    document.cookie = cookieOrganizationId
      ? `${ACTIVE_ORGANIZATION_COOKIE_NAME}=${cookieOrganizationId}; path=/`
      : `${ACTIVE_ORGANIZATION_COOKIE_NAME}=; path=/; Max-Age=0`;
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "clear");
    const tabOrganization = new TabOrganization();
    tabOrganization.show(input.tabOrganizationId);
    const recovery = new StaleOrganizationRecovery(tabOrganization);
    const listener = vi.fn();
    const unsubscribe = recovery.subscribe(listener);

    return { recovery, queryClient, listener, unsubscribe, tabOrganization };
  }
});
