import { describe, expect, it } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import { resolveOrganizationSwitchDestination } from "./organizationSwitchDestination";

describe(resolveOrganizationSwitchDestination.name, () => {
  it.each([
    "/projects",
    "/projects/p-1",
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

  it.each(["/deployments", "/deployments/123", "/new-deployment/configure", "/activity"])(
    "sends %s to the deployments of a team organization while the projects pages are off",
    pathname => {
      const { team } = setup();

      expect(resolveOrganizationSwitchDestination(pathname, team)).toBe("/deployments");
    }
  );

  it("sends an organization-bound page to the deployments of a personal organization", () => {
    const { personal } = setup();

    expect(resolveOrganizationSwitchDestination("/deployments/123", personal)).toBe("/deployments");
  });

  it("does not keep the user on Members while the members page is off", () => {
    const { team, personal } = setup();

    expect(resolveOrganizationSwitchDestination("/members", team)).toBe("/deployments");
    expect(resolveOrganizationSwitchDestination("/members", personal)).toBe("/deployments");
  });

  it.each(["/billing", "/usage"])("keeps %s only for a role that can see it", pathname => {
    const { team, asMember, asViewer } = setup();

    expect(resolveOrganizationSwitchDestination(pathname, team)).toBe(pathname);
    expect(resolveOrganizationSwitchDestination(pathname, asMember)).toBe("/deployments");
    expect(resolveOrganizationSwitchDestination(pathname, asViewer)).toBe("/deployments");
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
      createdAt: "2026-02-01T00:00:00Z"
    };
    const personal: OrganizationOutput = { ...team, id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner" };

    return { team, personal, asMember: { ...team, role: "member" as const }, asViewer: { ...team, role: "viewer" as const } };
  }
});
