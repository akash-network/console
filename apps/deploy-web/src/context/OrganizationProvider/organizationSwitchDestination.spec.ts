import { describe, expect, it } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import { resolveOrganizationSwitchDestination } from "./organizationSwitchDestination";

describe(resolveOrganizationSwitchDestination.name, () => {
  it.each([
    "/templates",
    "/templates/akash-chat",
    "/providers",
    "/providers/akash1abc",
    "/user/api-keys",
    "/alerts/new",
    "/user/settings",
    "/user/settings/favorites",
    "/profile/alice"
  ])("keeps the user on %s, which reads the same for every organization", pathname => {
    const { team } = setup();

    expect(resolveOrganizationSwitchDestination(`${pathname}?tab=1`, team)).toBe(`${pathname}?tab=1`);
  });

  it.each(["/deployments", "/deployments/123", "/new-deployment/configure", "/activity", "/projects/p-1"])(
    "sends %s to the projects of a team organization",
    pathname => {
      const { team } = setup();

      expect(resolveOrganizationSwitchDestination(pathname, team)).toBe("/projects");
    }
  );

  it("keeps the projects page of a team organization", () => {
    const { team } = setup();

    expect(resolveOrganizationSwitchDestination("/projects?view=all", team)).toBe("/projects?view=all");
  });

  it("keeps the deployments page of a personal organization and sends its projects page there", () => {
    const { personal } = setup();

    expect(resolveOrganizationSwitchDestination("/deployments?page=2", personal)).toBe("/deployments?page=2");
    expect(resolveOrganizationSwitchDestination("/projects", personal)).toBe("/deployments");
  });

  it("sends an organization-bound page to the deployments of a personal organization", () => {
    const { personal } = setup();

    expect(resolveOrganizationSwitchDestination("/deployments/123", personal)).toBe("/deployments");
  });

  it.each(["/members", "/organization"])("keeps %s only for a team organization", pathname => {
    const { team, personal } = setup();

    expect(resolveOrganizationSwitchDestination(pathname, team)).toBe(pathname);
    expect(resolveOrganizationSwitchDestination(pathname, personal)).toBe("/deployments");
  });

  it.each(["/billing", "/usage"])("keeps %s only for a role that can see it", pathname => {
    const { team, asMember, asViewer } = setup();

    expect(resolveOrganizationSwitchDestination(pathname, team)).toBe(pathname);
    expect(resolveOrganizationSwitchDestination(pathname, asMember)).toBe("/projects");
    expect(resolveOrganizationSwitchDestination(pathname, asViewer)).toBe("/projects");
  });

  it("falls back to the deployments list for an organization it does not know", () => {
    expect(resolveOrganizationSwitchDestination("/billing", undefined)).toBe("/deployments");
  });

  function setup() {
    const team: OrganizationOutput = {
      id: "org-2",
      name: "Acme Corp",
      slug: "acme-corp",
      type: "team",
      role: "admin",
      isActive: false,
      hasPaymentMethod: null,
      createdAt: "2026-02-01T00:00:00Z"
    };
    const personal: OrganizationOutput = { ...team, id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner" };

    return { team, personal, asMember: { ...team, role: "member" as const }, asViewer: { ...team, role: "viewer" as const } };
  }
});
