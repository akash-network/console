import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./OrganizationSwitcher";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(OrganizationSwitcher.name, () => {
  it("shows a person without a team their personal account, an empty organizations section and the create row", async () => {
    const { user } = setup({ activeId: "org-1", teams: [] });

    await user.click(screen.getByRole("button", { name: "alice, switch organization" }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /alice/, checked: true })).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(1);
    expect(within(menu).getByText("Organizations")).toBeInTheDocument();
    expect(
      within(menu).getByText("You're not in any organizations yet. Create one to share projects, deployments and billing with your team.")
    ).toBeInTheDocument();
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Create organization" })).toBeInTheDocument();
  });

  it("lets a person without a team create an organization", async () => {
    const { user, onCreateOrganization, onNavigate } = setup({ activeId: "org-1", teams: [] });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Create organization" }));

    expect(onCreateOrganization).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("stays out of the way for a person without a team where no organization can be created", () => {
    const { container } = setup({ activeId: "org-1", teams: [], canCreate: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("stays out of the way until the active organization is known", () => {
    const { container } = setup({ activeId: "unknown" });

    expect(container).toBeEmptyDOMElement();
  });

  it("names the current organization in a trigger that is not the account menu", () => {
    setup({ activeId: "org-2" });

    const trigger = screen.getByRole("button", { name: "Acme Corp, switch organization" });
    expect(trigger).toHaveTextContent("Acme Corp");
    expect(screen.queryByRole("button", { name: /account menu/i })).not.toBeInTheDocument();
  });

  it("lists the personal account, then the organizations with their roles, and checks the current one", async () => {
    const { user } = setup({ activeId: "org-2" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Personal account")).toBeInTheDocument();
    expect(within(menu).getByText("Organizations")).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map(item => item.textContent)
    ).toEqual(["A" + "alice", "A" + "Acme Corp" + "Admin", "N" + "Northwind Labs" + "Member"]);
    expect(within(menu).getByRole("menuitemradio", { name: /Acme Corp/, checked: true })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /alice/, checked: false })).toBeInTheDocument();
    expect(within(menu).queryByText(/not in any organizations/)).not.toBeInTheDocument();
  });

  it("switches to the chosen organization", async () => {
    const { user, switchOrganization, onNavigate } = setup({ activeId: "org-1" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Northwind Labs/ }));

    expect(switchOrganization).toHaveBeenCalledExactlyOnceWith("org-3");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("does not switch when the current organization is chosen again", async () => {
    const { user, switchOrganization, onNavigate } = setup({ activeId: "org-2" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Acme Corp/ }));

    expect(switchOrganization).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("offers to create an organization", async () => {
    const { user, onCreateOrganization, onNavigate } = setup({ activeId: "org-1" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Create organization" }));

    expect(onCreateOrganization).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("leaves out the create row where no dialog can be opened", async () => {
    const { user } = setup({ activeId: "org-1", canCreate: false });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));

    expect(await screen.findByRole("menuitemradio", { name: /Acme Corp/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Create organization" })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("closes with Escape", async () => {
    const { user } = setup({ activeId: "org-1" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  function setup(input: { activeId?: string; teams?: OrganizationOutput[]; canCreate?: boolean }) {
    const personal: OrganizationOutput = {
      id: "org-1",
      name: "alice",
      slug: "personal-0123456789ab",
      type: "personal",
      role: "owner",
      isActive: false,
      createdAt: "2026-01-01T00:00:00Z"
    };
    const teams = input.teams ?? [
      { ...personal, id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin" },
      { ...personal, id: "org-3", name: "Northwind Labs", slug: "northwind-labs", type: "team", role: "member" }
    ];
    const organizations = [personal, ...teams].map(organization => ({ ...organization, isActive: organization.id === input.activeId }));
    const switchOrganization = vi.fn();
    const onCreateOrganization = vi.fn();
    const onNavigate = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          organizations,
          activeOrganization: organizations.find(organization => organization.isActive),
          switchOrganization
        })
    };

    const { container } = render(
      <OrganizationSwitcher
        dependencies={dependencies}
        onCreateOrganization={input.canCreate === false ? undefined : onCreateOrganization}
        onNavigate={onNavigate}
      />
    );

    return { user: userEvent.setup(), container, switchOrganization, onCreateOrganization, onNavigate };
  }
});
