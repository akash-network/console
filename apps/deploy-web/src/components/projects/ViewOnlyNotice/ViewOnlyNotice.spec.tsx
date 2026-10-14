import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES, ViewOnlyReason } from "./ViewOnlyNotice";
import { ViewOnlyNotice } from "./ViewOnlyNotice";

import { render, screen } from "@testing-library/react";

describe(ViewOnlyNotice.name, () => {
  it("explains view-only access and names the organization whose admins can change it", () => {
    setup({ organizationName: "Acme Corp" });

    expect(screen.getByRole("heading", { name: "You have view-only access" })).toBeInTheDocument();
    expect(
      screen.getByText("You can see deployments here but not create, close or fund them. Ask an owner or admin of Acme Corp if you need more access.")
    ).toBeInTheDocument();
  });

  it("tells a caller who was given no project that they have none and whom to ask", () => {
    setup({ organizationName: "Acme Corp", reason: "no_projects" });

    expect(screen.getByRole("heading", { name: "No projects to show" })).toBeInTheDocument();
    expect(screen.getByText("You don't have access to any project yet. Ask an owner or admin.")).toBeInTheDocument();
    expect(screen.queryByText(/view-only/)).not.toBeInTheDocument();
  });

  it("falls back to a generic organization name before the organization is known", () => {
    setup({});

    expect(screen.getByText(/Ask an owner or admin of your organization/)).toBeInTheDocument();
  });

  function setup(input: { organizationName?: string; reason?: ViewOnlyReason }) {
    const activeOrganization = input.organizationName ? mock<OrganizationOutput>({ name: input.organizationName }) : undefined;
    const dependencies: typeof DEPENDENCIES = {
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization })
    };

    render(<ViewOnlyNotice reason={input.reason ?? "view_only"} dependencies={dependencies} />);
  }
});
