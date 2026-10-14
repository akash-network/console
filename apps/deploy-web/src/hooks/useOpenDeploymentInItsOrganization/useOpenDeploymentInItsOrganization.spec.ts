import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./useOpenDeploymentInItsOrganization";
import { useOpenDeploymentInItsOrganization } from "./useOpenDeploymentInItsOrganization";

import { renderHook } from "@testing-library/react";

const PERSONAL: OrganizationOutput = { id: "org-1", name: "alice", slug: "alice", type: "personal", role: "owner", isActive: true, createdAt: "" };
const TEAM: OrganizationOutput = { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "member", isActive: false, createdAt: "" };

describe(useOpenDeploymentInItsOrganization.name, () => {
  it("switches to the organization the deployment belongs to, back on the same deployment and tab", () => {
    const { switchOrganization, rerender } = setup({ locatedIn: "org-2", query: "tab=LOGS" });

    rerender();

    expect(switchOrganization).toHaveBeenCalledTimes(1);
    expect(switchOrganization).toHaveBeenCalledWith("org-2", { destination: "/deployments/100?tab=LOGS" });
  });

  it("lands on the bare deployment when the page had no query", () => {
    const { switchOrganization } = setup({ locatedIn: "org-2" });

    expect(switchOrganization).toHaveBeenCalledWith("org-2", { destination: "/deployments/100" });
  });

  it("stays put while the active organization can read the deployment, since another owner may share the dseq", () => {
    const { switchOrganization, useDeploymentLocationQuery } = setup({ locatedIn: "org-2", isMissingHere: false });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("stays put for a deployment of the active organization", () => {
    const { switchOrganization } = setup({ locatedIn: "org-1" });

    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("stays put for an organization the user does not belong to", () => {
    const { switchOrganization } = setup({ locatedIn: "org-9" });

    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("stays put while the location is unknown", () => {
    const { switchOrganization } = setup({ locatedIn: undefined });

    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("asks nothing while organizations are off", () => {
    const { useDeploymentLocationQuery } = setup({ locatedIn: undefined, isOrganizationsEnabled: false });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
  });

  it("asks nothing before an organization is active", () => {
    const { useDeploymentLocationQuery, switchOrganization } = setup({ locatedIn: "org-2", hasActiveOrganization: false });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  function setup(input: {
    locatedIn: string | undefined;
    isOrganizationsEnabled?: boolean;
    hasActiveOrganization?: boolean;
    isMissingHere?: boolean;
    query?: string;
  }) {
    const switchOrganization = vi.fn(() => true);
    const useDeploymentLocationQuery = vi.fn<typeof DEPENDENCIES.useDeploymentLocationQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
        data: input.locatedIn ? { organizationId: input.locatedIn, organizationSlug: "acme-corp", projectId: "p1" } : null
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      useFlag: () => input.isOrganizationsEnabled ?? true,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          organizations: [PERSONAL, TEAM],
          activeOrganization: input.hasActiveOrganization === false ? undefined : PERSONAL,
          switchOrganization
        }),
      useDeploymentLocationQuery
    };

    const hook = renderHook(() =>
      useOpenDeploymentInItsOrganization({ dseq: "100", isMissingHere: input.isMissingHere ?? true, query: input.query ?? "" }, dependencies)
    );

    return { ...hook, switchOrganization, useDeploymentLocationQuery };
  }
});
