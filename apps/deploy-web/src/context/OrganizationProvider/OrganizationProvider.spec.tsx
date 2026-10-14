import { useEffect } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { QueryObserverLoadingErrorResult, QueryObserverLoadingResult, QueryObserverSuccessResult, UseQueryResult } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createStore } from "jotai";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVE_ORGANIZATION_COOKIE_NAME } from "@src/lib/active-organization/active-organization-cookie";
import { ORGANIZATIONS_QUERY_KEY } from "@src/queries/useOrganizationQueries";
import { StaleOrganizationRecovery } from "@src/services/stale-organization-recovery/stale-organization-recovery";
import { settingsIdAtom } from "@src/store/settingsStore";
import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./OrganizationProvider";
import { OrganizationProvider, useActiveOrganization } from "./OrganizationProvider";

import { act, renderHook } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(OrganizationProvider.name, () => {
  it("exposes no organization while the feature is off", () => {
    const { result, organizationsQuery } = setup({ isEnabled: false });

    expect(result.current.organizations).toEqual([]);
    expect(result.current.activeOrganization).toBeUndefined();
    expect(result.current.projectsEnabled).toBe(false);
    expect(organizationsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("only loads the memberships of a signed-in user", () => {
    const { organizationsQuery } = setup({ hasUser: false });

    expect(organizationsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("resolves the active organization from the memberships", () => {
    const { result } = setup({});

    expect(result.current.organizations.map(organization => organization.name)).toEqual(["alice", "Acme Corp", "Northwind Labs"]);
    expect(result.current.activeOrganization?.id).toBe("org-1");
  });

  it("is loading until the first memberships arrive", () => {
    const { result } = setup({ organizations: undefined, isQueryLoading: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeOrganization).toBeUndefined();
  });

  it("turns the projects experience on for a team organization only", () => {
    const { result: personal } = setup({});
    const { result: team } = setup({ activeId: "org-2" });

    expect(personal.current.projectsEnabled).toBe(false);
    expect(team.current.projectsEnabled).toBe(true);
  });

  it("is loading while the feature flags have not answered, since the organizations flag may still turn on", () => {
    const { result: waiting } = setup({ isEnabled: false, areFeatureFlagsReady: false });
    const { result: answered } = setup({ isEnabled: false, areFeatureFlagsReady: true });

    expect(waiting.current.isLoading).toBe(true);
    expect(waiting.current.activeOrganization).toBeUndefined();
    expect(answered.current.isLoading).toBe(false);
  });

  it("reports memberships that could not be loaded", () => {
    const { result } = setup({ organizations: undefined, isQueryError: true });

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports no error once memberships are known, even when a later reload fails", () => {
    const { result, organizationsQuery, rerender } = setup({});

    organizationsQuery.mockReturnValue(errorResult());
    rerender();

    expect(result.current.isError).toBe(false);
    expect(result.current.activeOrganization?.id).toBe("org-1");
  });

  describe("switchOrganization", () => {
    it("records the choice in the cookie and forgets everything of the previous organization", async () => {
      const { result, queryClient, store } = setup({});

      await act(async () => result.current.switchOrganization("org-2"));

      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-2`);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(store.get(settingsIdAtom)).toBeNull();
    });

    it("covers the page until the navigation into the new organization has landed", async () => {
      let landSwitch: (landed: boolean) => void = () => undefined;
      const { result, isPageCovered, onMount } = setup({ replaceResult: new Promise<boolean>(resolve => (landSwitch = resolve)) });

      expect(isPageCovered()).toBe(false);

      await act(async () => result.current.switchOrganization("org-2"));
      expect(isPageCovered()).toBe(true);
      expect(onMount).toHaveBeenCalledOnce();

      await act(async () => landSwitch(true));
      expect(isPageCovered()).toBe(false);
      expect(onMount).toHaveBeenCalledTimes(2);
    });

    it("uncovers the page when the navigation into the new organization fails", async () => {
      let failSwitch: (error: Error) => void = () => undefined;
      const { result, isPageCovered } = setup({ replaceResult: new Promise<boolean>((_resolve, reject) => (failSwitch = reject)) });

      await act(async () => result.current.switchOrganization("org-2"));
      await act(async () => failSwitch(new Error("navigation cancelled")));

      expect(isPageCovered()).toBe(false);
    });

    it("mounts the page again so nothing rendered for the previous organization survives", async () => {
      const { result, onMount } = setup({});

      await act(async () => result.current.switchOrganization("org-2"));

      expect(onMount).toHaveBeenCalledTimes(2);
    });

    it("answers whether it switched", async () => {
      const { result } = setup({});
      const answers: boolean[] = [];

      await act(async () => {
        answers.push(result.current.switchOrganization("org-unknown"));
      });
      await act(async () => {
        answers.push(result.current.switchOrganization("org-2"));
      });

      expect(answers).toEqual([false, true]);
    });

    it("ignores an organization the user does not belong to", async () => {
      const { result, router, queryClient, store, onMount } = setup({});

      await act(async () => result.current.switchOrganization("org-unknown"));

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(store.get(settingsIdAtom)).toBe("akash1previous");
      expect(router.replace).not.toHaveBeenCalled();
      expect(onMount).toHaveBeenCalledOnce();
      expect(result.current.activeOrganization?.id).toBe("org-1");
    });

    it("takes an organization id, not a slug", async () => {
      const { result, router } = setup({});

      await act(async () => result.current.switchOrganization("acme-corp"));

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("shows the chosen organization right away, before the server confirms it", async () => {
      const { result, organizationsQuery, rerender } = setup({});

      await act(async () => result.current.switchOrganization("org-2"));
      organizationsQuery.mockReturnValue(loadingResult());
      rerender();

      expect(result.current.activeOrganization?.id).toBe("org-2");
      expect(result.current.organizations).toHaveLength(3);
      expect(result.current.isLoading).toBe(false);
    });

    it("follows the server once it confirms the switch", async () => {
      const { result, organizationsQuery, rerender, buildOrganizations } = setup({});

      await act(async () => result.current.switchOrganization("org-2"));
      organizationsQuery.mockReturnValue(loadedResult(buildOrganizations("org-2")));
      rerender();

      expect(result.current.activeOrganization?.id).toBe("org-2");
    });

    it("follows the server when it settles on another organization than the one chosen", async () => {
      const { result, organizationsQuery, rerender, buildOrganizations } = setup({});

      await act(async () => result.current.switchOrganization("org-2"));
      organizationsQuery.mockReturnValue(loadingResult());
      rerender();
      organizationsQuery.mockReturnValue(loadedResult(buildOrganizations("org-1")));
      rerender();

      expect(result.current.activeOrganization?.id).toBe("org-1");
    });

    it("reloads the current page when it reads the same for every organization", async () => {
      const { result, router } = setup({ asPath: "/billing?openPayment=true" });

      await act(async () => result.current.switchOrganization("org-2"));

      expect(router.replace).toHaveBeenCalledWith("/billing?openPayment=true");
    });

    it("goes to the projects of a team organization from an organization-bound page", async () => {
      const { result, router } = setup({ asPath: "/deployments/123" });

      await act(async () => result.current.switchOrganization("org-2"));

      expect(router.replace).toHaveBeenCalledWith("/projects");
    });

    it("goes to the deployments of the personal organization from an organization-bound page", async () => {
      const { result, router } = setup({ activeId: "org-2", asPath: "/deployments/123" });

      await act(async () => result.current.switchOrganization("org-1"));

      expect(router.replace).toHaveBeenCalledWith("/deployments");
    });

    it("leaves a page the new role cannot see", async () => {
      const { result, router } = setup({ asPath: "/usage" });

      await act(async () => result.current.switchOrganization("org-3"));

      expect(router.replace).toHaveBeenCalledWith("/projects");
    });

    it("switches into an organization the user just created and lands where the caller asks", async () => {
      const { result, router, queryClient, buildOrganizations, organizationsQuery, rerender } = setup({ asPath: "/deployments" });
      const created: OrganizationOutput = {
        id: "org-9",
        name: "Globex",
        slug: "globex",
        type: "team",
        role: "owner",
        isActive: false,
        createdAt: "2026-04-01T00:00:00Z"
      };
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, { data: [...buildOrganizations("org-1"), created] });

      await act(async () => result.current.switchOrganization("org-9", { destination: "/templates" }));
      organizationsQuery.mockReturnValue(loadingResult());
      rerender();

      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-9`);
      expect(router.replace).toHaveBeenCalledWith("/templates");
      expect(result.current.activeOrganization?.name).toBe("Globex");
    });
  });

  describe("when the API refuses the active organization", () => {
    it("forgets the refused organization and mounts the page again", async () => {
      const { result, recovery, queryClient, store, onMount, organizationsQuery, rerender } = setup({});
      await act(async () => result.current.switchOrganization("org-2"));
      organizationsQuery.mockReturnValue(loadingResult());
      rerender();
      store.set(settingsIdAtom, "akash1refused");

      act(() => {
        recovery.recover(new ApiError(403, { code: "organization_forbidden" }, "GET /v1/deployments → 403"), queryClient);
      });

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(result.current.activeOrganization).toBeUndefined();
      expect(result.current.organizations).toEqual([]);
      expect(store.get(settingsIdAtom)).toBeNull();
      expect(onMount).toHaveBeenCalledTimes(3);
    });

    it("follows the organization the API picks once the memberships reload", async () => {
      const { result, recovery, queryClient, organizationsQuery, rerender, buildOrganizations } = setup({});
      await act(async () => result.current.switchOrganization("org-2"));
      organizationsQuery.mockReturnValue(loadingResult());
      rerender();

      act(() => {
        recovery.recover(new ApiError(403, { code: "organization_forbidden" }, "GET /v1/deployments → 403"), queryClient);
      });
      organizationsQuery.mockReturnValue(loadedResult(buildOrganizations("org-1")));
      rerender();

      expect(result.current.activeOrganization?.id).toBe("org-1");
    });
  });

  describe("when the URL names an organization", () => {
    it("switches to it and drops the parameter from the URL", () => {
      const { router, queryClient } = setup({ asPath: "/deployments/123?org=acme-corp&tab=logs", query: { org: "acme-corp", tab: "logs" } });

      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-2`);
      expect(queryClient.clear).toHaveBeenCalledOnce();
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/deployments/123?tab=logs");
    });

    it("accepts the organization id as well as its slug", () => {
      setup({ asPath: "/deployments?org=org-3", query: { org: "org-3" } });

      expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-3`);
    });

    it("only drops the parameter when it names the organization already in use", () => {
      const { router, queryClient } = setup({ asPath: "/deployments?org=org-1", query: { org: "org-1" } });

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/deployments", undefined, { shallow: true });
    });

    it("ignores an organization the user does not belong to", () => {
      const { router, queryClient } = setup({ asPath: "/deployments?org=globex", query: { org: "globex" } });

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(queryClient.clear).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/deployments", undefined, { shallow: true });
    });

    it("ignores a parameter given more than once", () => {
      const { router } = setup({ asPath: "/deployments?org=acme-corp&org=org-3", query: { org: ["acme-corp", "org-3"] } });

      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/deployments", undefined, { shallow: true });
    });

    it("covers the page while the memberships that could match it are loading", () => {
      const { isPageCovered } = setup({ asPath: "/deployments?org=acme-corp", query: { org: "acme-corp" }, organizations: undefined, isQueryLoading: true });

      expect(isPageCovered()).toBe(true);
    });

    it("does not cover the page while memberships load for a URL that names no organization", () => {
      const { isPageCovered } = setup({ organizations: undefined, isQueryLoading: true });

      expect(isPageCovered()).toBe(false);
    });

    it("waits for the router and the memberships before acting on it", () => {
      const { router: notReady } = setup({ asPath: "/deployments?org=acme-corp", query: { org: "acme-corp" }, isRouterReady: false });
      const { router: notLoaded } = setup({
        asPath: "/deployments?org=acme-corp",
        query: { org: "acme-corp" },
        organizations: undefined,
        isQueryLoading: true
      });

      expect(notReady.replace).not.toHaveBeenCalled();
      expect(notLoaded.replace).not.toHaveBeenCalled();
      expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
    });

    it("acts on it once even though the memberships reload after the switch", () => {
      const { router, organizationsQuery, rerender, buildOrganizations } = setup({ asPath: "/deployments?org=acme-corp", query: { org: "acme-corp" } });

      organizationsQuery.mockReturnValue(loadedResult(buildOrganizations("org-2")));
      rerender();

      expect(router.replace).toHaveBeenCalledOnce();
    });

    it("does nothing while the feature is off", () => {
      const { router } = setup({ isEnabled: false, asPath: "/deployments?org=acme-corp", query: { org: "acme-corp" } });

      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    isEnabled?: boolean;
    hasUser?: boolean;
    activeId?: string;
    organizations?: OrganizationOutput[] | undefined;
    isQueryLoading?: boolean;
    isQueryError?: boolean;
    areFeatureFlagsReady?: boolean;
    asPath?: string;
    query?: NextRouter["query"];
    isRouterReady?: boolean;
    replaceResult?: Promise<boolean>;
  }) {
    document.cookie = `${ACTIVE_ORGANIZATION_COOKIE_NAME}=; path=/; Max-Age=0`;

    const buildOrganizations = (activeId: string): OrganizationOutput[] =>
      [
        { id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner", createdAt: "2026-01-01T00:00:00Z" },
        { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin", createdAt: "2026-02-01T00:00:00Z" },
        { id: "org-3", name: "Northwind Labs", slug: "northwind-labs", type: "team", role: "member", createdAt: "2026-03-01T00:00:00Z" }
      ].map(organization => ({ ...organization, isActive: organization.id === activeId }) as OrganizationOutput);

    const organizations = "organizations" in input ? input.organizations : buildOrganizations(input.activeId ?? "org-1");
    const initialQueryResult = input.isQueryError ? errorResult() : input.isQueryLoading ? loadingResult() : loadedResult(organizations ?? []);
    const organizationsQuery = vi.fn<typeof DEPENDENCIES.useOrganizationsQuery>(() => initialQueryResult);
    const router = mock<NextRouter>({
      asPath: input.asPath ?? "/deployments",
      isReady: input.isRouterReady ?? true,
      replace: vi.fn().mockReturnValue(input.replaceResult ?? Promise.resolve(true))
    });
    router.query = input.query ?? {};
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "clear");
    const store = createStore();
    store.set(settingsIdAtom, "akash1previous");
    const recovery = new StaleOrganizationRecovery();
    const onMount = vi.fn();
    let coveringCount = 0;

    const dependencies: typeof DEPENDENCIES = {
      useFlag: () => input.isEnabled ?? true,
      useFeatureFlagsReady: () => input.areFeatureFlagsReady ?? true,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.hasUser === false ? undefined : { id: "user-1", userId: "auth0|user-1" } }),
      useOrganizationsQuery: organizationsQuery,
      useRouter: () => router,
      useQueryClient: () => queryClient,
      useStore: () => store,
      BootLoading: function CoverPage() {
        useEffect(() => {
          coveringCount += 1;
          return () => {
            coveringCount -= 1;
          };
        }, []);
        return null;
      }
    };

    const { result, rerender } = renderHook(
      () => {
        useEffect(onMount, []);
        return useActiveOrganization();
      },
      {
        wrapper: ({ children }) => (
          <TestContainerProvider services={{ staleOrganizationRecovery: () => recovery }}>
            <OrganizationProvider dependencies={dependencies}>{children}</OrganizationProvider>
          </TestContainerProvider>
        )
      }
    );

    return { result, rerender, organizationsQuery, router, queryClient, store, recovery, onMount, buildOrganizations, isPageCovered: () => coveringCount > 0 };
  }

  function loadedResult(data: OrganizationOutput[]): UseQueryResult<OrganizationOutput[]> {
    return mock<QueryObserverSuccessResult<OrganizationOutput[]>>({ data, isLoading: false, isError: false });
  }

  function loadingResult(): UseQueryResult<OrganizationOutput[]> {
    return mock<QueryObserverLoadingResult<OrganizationOutput[]>>({ data: undefined, isLoading: true, isError: false });
  }

  function errorResult(): UseQueryResult<OrganizationOutput[]> {
    return mock<QueryObserverLoadingErrorResult<OrganizationOutput[]>>({ data: undefined, isLoading: false, isError: true });
  }
});
