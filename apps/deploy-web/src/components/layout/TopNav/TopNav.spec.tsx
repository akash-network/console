import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, TopNav } from "./TopNav";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(TopNav.name, () => {
  it("renders primary nav links for an authenticated user", () => {
    setup({ isAuthenticated: true });

    expect(screen.getByRole("link", { name: "Deployments" })).toHaveAttribute("href", "/deployments");
    expect(screen.getByRole("link", { name: "Providers" })).toHaveAttribute("href", "/providers");
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("links the logo to the deployments list", () => {
    setup({ isAuthenticated: true });

    expect(screen.getByRole("link", { name: "Akash Console home" })).toHaveAttribute("href", "/deployments");
  });

  it("links the mobile menu logo to the deployments list", async () => {
    setup({ isAuthenticated: true });

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const mobileMenu = await screen.findByRole("dialog");
    expect(within(mobileMenu).getByRole("link", { name: "Akash Console home" })).toHaveAttribute("href", "/deployments");
  });

  it("closes the mobile menu when its logo is clicked", async () => {
    setup({ isAuthenticated: true });
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const mobileMenu = await screen.findByRole("dialog");
    const stopNavigation = (event: Event) => event.preventDefault();
    document.addEventListener("click", stopNavigation);

    await userEvent.click(within(mobileMenu).getByRole("link", { name: "Akash Console home" }));
    document.removeEventListener("click", stopNavigation);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the activity bell to a signed-in user", () => {
    setup({ isAuthenticated: true });

    expect(screen.getByRole("button", { name: "Activity" })).toBeInTheDocument();
  });

  it("leaves the activity bell out when signed out and in minimal mode", () => {
    setup({ isAuthenticated: false });
    setup({ isAuthenticated: true, minimal: true });

    expect(screen.queryByRole("button", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("shows the command menu to a signed-in user when its flag is on", () => {
    setup({ isAuthenticated: true, isCommandMenuEnabled: true });

    expect(screen.getByRole("button", { name: "Search or run a command" })).toBeInTheDocument();
  });

  it("leaves the command menu out while its flag is off", () => {
    const { useFlag } = setup({ isAuthenticated: true, isCommandMenuEnabled: false });

    expect(useFlag).toHaveBeenCalledWith("ui_command_menu");
    expect(screen.queryByRole("button", { name: "Search or run a command" })).not.toBeInTheDocument();
  });

  it("leaves the command menu out when signed out", () => {
    setup({ isAuthenticated: false, isCommandMenuEnabled: true });

    expect(screen.queryByRole("button", { name: "Search or run a command" })).not.toBeInTheDocument();
  });

  it("leaves the command menu out in minimal mode", () => {
    setup({ isAuthenticated: true, minimal: true, isCommandMenuEnabled: true });

    expect(screen.queryByRole("button", { name: "Search or run a command" })).not.toBeInTheDocument();
  });

  it("hides nav links when signed out", () => {
    setup({ isAuthenticated: false });

    expect(screen.queryByRole("link", { name: "Deployments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("hides nav links in minimal mode and reduces the account menu", () => {
    const { accountMenu } = setup({ isAuthenticated: true, minimal: true });

    expect(screen.queryByRole("link", { name: "Deployments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /settings/i })).not.toBeInTheDocument();
    expect(accountMenu.mock.calls[0][0]).toMatchObject({ minimal: true });
  });

  it("marks the link matching the current route as active", () => {
    setup({ isAuthenticated: true, pathname: "/providers" });

    expect(screen.getByRole("link", { name: "Providers" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Deployments" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Templates" })).not.toHaveAttribute("aria-current");
  });

  it("marks Deployments active on the new deployment flow", () => {
    setup({ isAuthenticated: true, pathname: "/new-deployment/configure" });

    expect(screen.getByRole("link", { name: "Deployments" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark a link active for a route that only shares its prefix", () => {
    setup({ isAuthenticated: true, pathname: "/providers-old" });

    expect(screen.getByRole("link", { name: "Providers" })).not.toHaveAttribute("aria-current");
  });

  it("leads with Projects once organizations are on and the organization uses projects", () => {
    setup({ isAuthenticated: true, isOrganizationsEnabled: true, projectsEnabled: true, pathname: "/projects/p1" });

    const links = screen.getByRole("navigation", { name: "Primary" }).querySelectorAll("a");
    expect(links[0]).toHaveTextContent("Projects");
    expect(links[0]).toHaveAttribute("href", "/projects");
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("leaves Projects out while organizations are off", () => {
    setup({ isAuthenticated: true, isOrganizationsEnabled: false, projectsEnabled: true });

    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("leaves Projects out for an organization that does not use projects", () => {
    setup({ isAuthenticated: true, isOrganizationsEnabled: true, projectsEnabled: false });

    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("shows all settings items", async () => {
    setup({ isAuthenticated: true });

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("menuitem", { name: "Billing" })).toHaveAttribute("href", "/billing");
    expect(screen.getByRole("menuitem", { name: "API Keys" })).toHaveAttribute("href", "/user/api-keys");
    expect(screen.getByRole("menuitem", { name: "Usage" })).toHaveAttribute("href", "/usage");
    expect(screen.getByRole("menuitem", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
  });

  describe("organizations", () => {
    it("leaves the switcher and the create entry out while organizations are off", () => {
      const { accountMenu, organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: false });

      expect(organizationSwitcher).not.toHaveBeenCalled();
      expect(accountMenu.mock.calls[0][0]).toEqual(expect.objectContaining({ onCreateOrganization: undefined }));
    });

    it("adds the switcher to the header for a signed-in user when organizations are on", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: true });

      expect(organizationSwitcher).toHaveBeenCalled();
      expect(organizationSwitcher.mock.calls[0][0]).not.toHaveProperty("layout");
    });

    it("keeps the switcher in the reduced onboarding header, on phones too", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: true, minimal: true });

      expect(organizationSwitcher).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Switch organization" }).closest(".hidden")).toBeNull();
    });

    it("keeps the header switcher visible at every width, next to the copy in the mobile menu", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: true });

      expect(screen.getByRole("button", { name: "Switch organization" }).closest(".hidden")).toBeNull();
      expect(organizationSwitcher.mock.calls[0][0]).not.toHaveProperty("layout");
    });

    it("leaves the switcher out for a signed-out visitor", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: false, isOrganizationsEnabled: true });

      expect(organizationSwitcher).not.toHaveBeenCalled();
    });

    it("puts the switcher at the top of the mobile menu", async () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: true });

      await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

      const mobileMenu = await screen.findByRole("dialog");
      expect(within(mobileMenu).getByRole("button", { name: "Switch organization" })).toBeInTheDocument();
      expect(organizationSwitcher.mock.calls.some(call => call[0].layout === "sheet")).toBe(true);
    });

    it("opens the create organization dialog from the account menu and closes it again", async () => {
      const { accountMenu } = setup({ isAuthenticated: true, isOrganizationsEnabled: true });

      act(() => accountMenu.mock.calls[0][0]?.onCreateOrganization?.());

      expect(screen.getByRole("dialog", { name: "Create organization dialog" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
      expect(screen.queryByRole("dialog", { name: "Create organization dialog" })).not.toBeInTheDocument();
    });

    it("opens the create organization dialog from the switcher", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, isOrganizationsEnabled: true });

      act(() => organizationSwitcher.mock.calls[0][0].onCreateOrganization?.());

      expect(screen.getByRole("dialog", { name: "Create organization dialog" })).toBeInTheDocument();
    });
  });

  function setup(input: {
    isAuthenticated?: boolean;
    minimal?: boolean;
    pathname?: string;
    isCommandMenuEnabled?: boolean;
    isOrganizationsEnabled?: boolean;
    projectsEnabled?: boolean;
  }) {
    const accountMenu = vi.fn<typeof DEPENDENCIES.TopNavAccountMenu>(() => <></>);
    const enabledFlags = { ui_command_menu: input.isCommandMenuEnabled ?? false, organizations: input.isOrganizationsEnabled ?? false };
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(flag => enabledFlags[flag as keyof typeof enabledFlags] ?? false);
    const organizationSwitcher = vi.fn<typeof DEPENDENCIES.OrganizationSwitcher>(() => <button type="button">Switch organization</button>);
    const createOrganizationDialog = vi.fn<typeof DEPENDENCIES.CreateOrganizationDialog>(({ onClose }) => (
      <div role="dialog" aria-label="Create organization dialog">
        <button type="button" onClick={onClose}>
          Close dialog
        </button>
      </div>
    ));

    const dependencies = MockComponents(DEPENDENCIES, {
      useUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: input.isAuthenticated ? { userId: "user-1" } : undefined
        }),
      usePathname: () => input.pathname ?? "/",
      useCookieTheme: () => "light",
      useFlag,
      CommandMenu: () => <button type="button">Search or run a command</button>,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          organizations: [],
          activeOrganization: undefined,
          projectsEnabled: input.projectsEnabled ?? false
        }),
      TopNavAccountMenu: accountMenu,
      ActivityBell: () => <button type="button">Activity</button>,
      OrganizationSwitcher: organizationSwitcher,
      CreateOrganizationDialog: createOrganizationDialog
    });

    render(<TopNav dependencies={dependencies} minimal={input.minimal} />);

    return { accountMenu, useFlag, organizationSwitcher };
  }
});
