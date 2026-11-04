import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./OrganizationSwitcher";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(OrganizationSwitcher.name, () => {
  it("shows a person without a team their personal account, a prompt to deploy as a team and the create row", async () => {
    const { user } = setup({ activeId: "org-1", teams: [] });

    await user.click(screen.getByRole("button", { name: "alice, switch organization" }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /alice/, checked: true })).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(1);
    expect(within(menu).queryByText("Organizations")).not.toBeInTheDocument();
    expect(within(menu).getByText("Deploy as a team")).toBeInTheDocument();
    expect(within(menu).getByText("Share projects and billing with teammates.")).toBeInTheDocument();
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

  it("lists the badged personal account, then the organizations with their roles, and checks the current one", async () => {
    const { user } = setup({ activeId: "org-2" });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Organizations")).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map(item => item.textContent)
    ).toEqual(["alice" + "Personal", "A" + "Acme Corp" + "Admin", "N" + "Northwind Labs" + "Member"]);
    expect(within(menu).getByRole("menuitemradio", { name: /Acme Corp/, checked: true })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /alice/, checked: false })).toBeInTheDocument();
    expect(within(menu).queryByText("Deploy as a team")).not.toBeInTheDocument();
  });

  it("shows the slug under the name of each organization whose name another one shares, whatever its case", async () => {
    const { user } = setup({
      activeId: "org-2",
      teams: [
        { id: "org-2", name: "Dup-x", slug: "dup-x", role: "owner" },
        { id: "org-3", name: "dup-x", slug: "dup-x-2", role: "member" },
        { id: "org-4", name: "Northwind Labs", slug: "northwind-labs", role: "member" }
      ]
    });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));

    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map(item => item.textContent)
    ).toEqual(["alice" + "Personal", "D" + "Dup-x" + "dup-x" + "Owner", "D" + "dup-x" + "dup-x-2" + "Member", "N" + "Northwind Labs" + "Member"]);
  });

  it("leaves the slug out for an organization named like the personal account", async () => {
    const { user } = setup({ activeId: "org-2", teams: [{ id: "org-2", name: "Alice", slug: "alice", role: "owner" }] });

    await user.click(screen.getByRole("button", { name: /switch organization/ }));

    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map(item => item.textContent)
    ).toEqual(["alice" + "Personal", "A" + "Alice" + "Owner"]);
  });

  it("badges the active personal account as a trial in the trigger and the menu while its wallet is trialing", async () => {
    const { user } = setup({ activeId: "org-1", isTrialing: true });

    const trigger = screen.getByRole("button", { name: "alice, switch organization" });
    expect(within(trigger).getByText("Trial")).toBeInTheDocument();

    await user.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /alice/ })).toHaveTextContent("alice" + "Trial");
  });

  it("badges the active personal account as personal when its wallet is not trialing", () => {
    setup({ activeId: "org-1", isTrialing: false });

    const trigger = screen.getByRole("button", { name: "alice, switch organization" });
    expect(within(trigger).getByText("Personal")).toBeInTheDocument();
    expect(within(trigger).queryByText("Trial")).not.toBeInTheDocument();
  });

  it("badges the personal account as personal while a team, whose wallet says nothing of the personal trial, is active", async () => {
    const { user } = setup({ activeId: "org-2", isTrialing: true });

    const trigger = screen.getByRole("button", { name: "Acme Corp, switch organization" });
    expect(within(trigger).queryByText("Personal")).not.toBeInTheDocument();
    expect(within(trigger).queryByText("Trial")).not.toBeInTheDocument();

    await user.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /alice/ })).toHaveTextContent("alice" + "Personal");
  });

  it("keeps the personal badge out of the compact phone header but shows it in the navigation sheet", () => {
    const header = setup({ activeId: "org-1", layout: "header" });
    expect(within(header.container).getByText("Personal")).toHaveClass("hidden", "sm:inline-flex");
    header.unmount();

    const sheet = setup({ activeId: "org-1", layout: "sheet" });
    expect(within(sheet.container).getByText("Personal")).not.toHaveClass("hidden");
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

  function setup(input: {
    activeId?: string;
    teams?: Pick<OrganizationOutput, "id" | "name" | "slug" | "role">[];
    canCreate?: boolean;
    isTrialing?: boolean;
    layout?: "header" | "sheet";
  }) {
    const personal: OrganizationOutput = {
      id: "org-1",
      name: "alice",
      slug: "personal-0123456789ab",
      type: "personal",
      role: "owner",
      isActive: false,
      hasPaymentMethod: null,
      createdAt: "2026-01-01T00:00:00Z"
    };
    const teams = (
      input.teams ?? [
        { id: "org-2", name: "Acme Corp", slug: "acme-corp", role: "admin" },
        { id: "org-3", name: "Northwind Labs", slug: "northwind-labs", role: "member" }
      ]
    ).map((team): OrganizationOutput => ({ ...personal, ...team, type: "team" }));
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
        }),
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false })
    };

    const { container, unmount } = render(
      <OrganizationSwitcher
        dependencies={dependencies}
        layout={input.layout}
        onCreateOrganization={input.canCreate === false ? undefined : onCreateOrganization}
        onNavigate={onNavigate}
      />
    );

    return { user: userEvent.setup(), container, unmount, switchOrganization, onCreateOrganization, onNavigate };
  }
});
