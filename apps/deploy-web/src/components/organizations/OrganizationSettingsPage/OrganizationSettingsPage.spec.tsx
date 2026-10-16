import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";
import { DEPENDENCIES, OrganizationSettingsPage } from "./OrganizationSettingsPage";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(OrganizationSettingsPage.name, () => {
  it("lets the owner rename the organization and transfer its ownership", () => {
    const { OrganizationNameSetting, OwnershipTransferSetting, SettingsLayout } = setup({ role: "owner" });

    expect(SettingsLayout.mock.lastCall?.[0]).toEqual(expect.objectContaining({ title: "General" }));
    expect(OrganizationNameSetting.mock.lastCall?.[0]).toEqual(expect.objectContaining({ organization: expect.objectContaining({ id: "org-2" }) }));
    expect(OwnershipTransferSetting.mock.lastCall?.[0]).toEqual(expect.objectContaining({ organization: expect.objectContaining({ name: "Acme Corp" }) }));
    expect(screen.getByRole("heading", { name: "Ownership" })).toBeInTheDocument();
    expect(screen.queryByText(/Only admins can rename it/)).not.toBeInTheDocument();
  });

  it("lets an admin rename the organization but not transfer it", () => {
    const { OrganizationNameSetting, OwnershipTransferSetting } = setup({ role: "admin" });

    expect(OrganizationNameSetting).toHaveBeenCalled();
    expect(OwnershipTransferSetting).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Ownership" })).not.toBeInTheDocument();
  });

  it.each(["member", "viewer", "billing"] as const)("shows a %s the name as plain text with a note on who can rename it", role => {
    const { OrganizationNameSetting, OwnershipTransferSetting } = setup({ role });

    expect(OrganizationNameSetting).not.toHaveBeenCalled();
    expect(OwnershipTransferSetting).not.toHaveBeenCalled();
    expect(screen.getByText("Acme Corp", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Shown to members across Console and in invitations.")).toBeInTheDocument();
    expect(screen.getByText(/Only admins can rename it\./)).toHaveTextContent(
      `You're a ${role.charAt(0).toUpperCase()}${role.slice(1)} of Acme Corp. Only admins can rename it.`
    );
  });

  it("sends a personal account away, since it has no general settings", () => {
    const { replace, OrganizationNameSetting } = setup({ type: "personal" });

    expect(replace).toHaveBeenCalledWith("/deployments");
    expect(OrganizationNameSetting).not.toHaveBeenCalled();
  });

  it("sends everyone away while organizations are off", () => {
    const { replace, OrganizationNameSetting } = setup({ isEnabled: false });

    expect(replace).toHaveBeenCalledWith("/deployments");
    expect(OrganizationNameSetting).not.toHaveBeenCalled();
  });

  it("sends the user away when no organization could be loaded", () => {
    const { replace } = setup({ hasOrganization: false, hasNoOrganizations: true });

    expect(replace).toHaveBeenCalledWith("/deployments");
  });

  it("waits for the active organization without leaving", () => {
    const { replace, OrganizationNameSetting, Layout } = setup({ hasOrganization: false });

    expect(replace).not.toHaveBeenCalled();
    expect(OrganizationNameSetting).not.toHaveBeenCalled();
    expect(Layout.mock.lastCall?.[0]).toEqual(expect.objectContaining({ isLoading: true }));
  });

  function setup(input: { role?: OrganizationRole; type?: OrganizationType; isEnabled?: boolean; hasOrganization?: boolean; hasNoOrganizations?: boolean }) {
    const organization: OrganizationOutput = {
      id: "org-2",
      name: "Acme Corp",
      slug: "acme-corp",
      type: input.type ?? "team",
      role: input.role ?? "owner",
      isActive: true,
      hasPaymentMethod: true,
      createdAt: "2026-02-01T00:00:00Z"
    };
    const replace = vi.fn();
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ children }) => <>{children}</>);
    const OrganizationNameSetting = vi.fn<typeof DEPENDENCIES.OrganizationNameSetting>(() => null);
    const OwnershipTransferSetting = vi.fn<typeof DEPENDENCIES.OwnershipTransferSetting>(() => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      SettingsLayout,
      OrganizationNameSetting,
      OwnershipTransferSetting,
      useFlag: () => input.isEnabled ?? true,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: input.hasOrganization ?? true ? organization : undefined,
          isError: input.hasNoOrganizations ?? false
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })
    });

    render(<OrganizationSettingsPage dependencies={dependencies} />);

    return { replace, Layout, SettingsLayout, OrganizationNameSetting, OwnershipTransferSetting };
  }
});
