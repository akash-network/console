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

  describe("assistant", () => {
    it("opens the assistant from the header for a signed-in user when it is on", async () => {
      const { openAssistant, useFlag } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: true });

      await userEvent.click(screen.getByRole("button", { name: "Ask the assistant" }));

      expect(useFlag).toHaveBeenCalledWith("user_feedback_loop");
      expect(openAssistant).toHaveBeenCalledWith();
    });

    it("binds the assistant shortcut through the command menu", () => {
      const { commandMenu, openAssistant } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: true, isCommandMenuEnabled: true });

      commandMenu.mock.lastCall![0].onOpenAssistant!();

      expect(openAssistant).toHaveBeenCalledTimes(1);
    });

    it("leaves the assistant out while it is off, when signed out and in minimal mode", () => {
      const { commandMenu } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: false, isCommandMenuEnabled: true });
      expect(commandMenu.mock.lastCall![0].onOpenAssistant).toBeUndefined();
      setup({ isAuthenticated: false, isFeedbackLoopEnabled: true });
      setup({ isAuthenticated: true, minimal: true, isFeedbackLoopEnabled: true });

      expect(screen.queryByRole("button", { name: "Ask the assistant" })).not.toBeInTheDocument();
    });
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

  it("leads with Projects when the organization uses projects", () => {
    setup({ isAuthenticated: true, projectsEnabled: true, pathname: "/projects/p1" });

    const links = screen.getByRole("navigation", { name: "Primary" }).querySelectorAll("a");
    expect(links[0]).toHaveTextContent("Projects");
    expect(links[0]).toHaveAttribute("href", "/projects");
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("leaves Projects out for an organization that does not use projects", () => {
    setup({ isAuthenticated: true, projectsEnabled: false });

    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("shows all settings items", async () => {
    setup({ isAuthenticated: true });

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("menuitem", { name: "Billing" })).toHaveAttribute("href", "/billing");
    expect(screen.getByRole("menuitem", { name: "API Keys" })).toHaveAttribute("href", "/user/api-keys");
    expect(screen.getByRole("menuitem", { name: "Usage" })).toHaveAttribute("href", "/usage");
    expect(screen.getByRole("menuitem", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
    expect(screen.queryByRole("menuitem", { name: "Referrals" })).not.toBeInTheDocument();
  });

  describe("organizations", () => {
    it("adds the switcher to the header for a signed-in user", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true });

      expect(organizationSwitcher).toHaveBeenCalled();
      expect(organizationSwitcher.mock.calls[0][0]).not.toHaveProperty("layout");
    });

    it("keeps the switcher in the reduced onboarding header, on phones too", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, minimal: true });

      expect(organizationSwitcher).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Switch organization" }).closest(".hidden")).toBeNull();
    });

    it("leaves organization creation out of the onboarding header's switcher so it only shows to team members", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true, minimal: true });

      expect(organizationSwitcher.mock.calls[0][0]).toEqual(expect.objectContaining({ onCreateOrganization: undefined }));
    });

    it("keeps the header switcher visible at every width, next to the copy in the mobile menu", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true });

      expect(screen.getByRole("button", { name: "Switch organization" }).closest(".hidden")).toBeNull();
      expect(organizationSwitcher.mock.calls[0][0]).not.toHaveProperty("layout");
    });

    it("leaves the switcher out for a signed-out visitor", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: false });

      expect(organizationSwitcher).not.toHaveBeenCalled();
    });

    it("puts the switcher at the top of the mobile menu", async () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true });

      await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

      const mobileMenu = await screen.findByRole("dialog");
      expect(within(mobileMenu).getByRole("button", { name: "Switch organization" })).toBeInTheDocument();
      expect(organizationSwitcher.mock.calls.some(call => call[0].layout === "sheet")).toBe(true);
    });

    it("opens the create organization dialog from the account menu and closes it again", async () => {
      const { accountMenu } = setup({ isAuthenticated: true });

      act(() => accountMenu.mock.calls[0][0]?.onCreateOrganization?.());

      expect(screen.getByRole("dialog", { name: "Create organization dialog" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
      expect(screen.queryByRole("dialog", { name: "Create organization dialog" })).not.toBeInTheDocument();
    });

    it("opens the create organization dialog from the switcher", () => {
      const { organizationSwitcher } = setup({ isAuthenticated: true });

      act(() => organizationSwitcher.mock.calls[0][0].onCreateOrganization?.());

      expect(screen.getByRole("dialog", { name: "Create organization dialog" })).toBeInTheDocument();
    });

    it("replays the release announcement from the account menu", () => {
      const { accountMenu, openWhatsNew } = setup({ isAuthenticated: true });

      act(() => accountMenu.mock.calls[0][0]?.onOpenWhatsNew?.());

      expect(openWhatsNew).toHaveBeenCalledWith("account_menu");
    });

    it("offers What's new in the mobile menu's account items", async () => {
      const { accountMenu, openWhatsNew } = setup({ isAuthenticated: true });

      await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const inlineMenuProps = accountMenu.mock.calls.find(call => call[0]?.variant === "inline")?.[0];
      act(() => inlineMenuProps?.onOpenWhatsNew?.());

      expect(openWhatsNew).toHaveBeenCalledWith("account_menu");
    });

    it("lets the release announce itself from the full header of a signed-in user", () => {
      const { whatsNewAutoOpen } = setup({ isAuthenticated: true });

      expect(whatsNewAutoOpen).toHaveBeenCalled();
    });

    it.each([
      { case: "to a signed-out visitor", isAuthenticated: false, minimal: false },
      { case: "during onboarding", isAuthenticated: true, minimal: true }
    ])("keeps the release from announcing itself $case", input => {
      const { whatsNewAutoOpen } = setup(input);

      expect(whatsNewAutoOpen).not.toHaveBeenCalled();
    });
  });

  describe("send feedback", () => {
    it("opens the feedback form from the account menu and closes it again", async () => {
      const { accountMenu } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: true });

      act(() => accountMenu.mock.calls[0][0]?.onSendFeedback?.());

      expect(screen.getByRole("dialog", { name: "Send feedback dialog" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Close feedback" }));
      expect(screen.queryByRole("dialog", { name: "Send feedback dialog" })).not.toBeInTheDocument();
    });

    it("offers the feedback form in the mobile menu's account items", async () => {
      const { accountMenu } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: true });

      await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const inlineMenuProps = accountMenu.mock.calls.find(call => call[0]?.variant === "inline")?.[0];
      act(() => inlineMenuProps?.onSendFeedback?.());

      expect(screen.getByRole("dialog", { name: "Send feedback dialog", hidden: true })).toBeInTheDocument();
    });

    it("leaves the feedback form out while the feedback loop is off", () => {
      const { accountMenu, useFlag } = setup({ isAuthenticated: true, isFeedbackLoopEnabled: false });

      expect(useFlag).toHaveBeenCalledWith("user_feedback_loop");
      expect(accountMenu.mock.calls[0][0]).toEqual(expect.objectContaining({ onSendFeedback: undefined }));
    });

    it("leaves the feedback form out for a signed-out visitor", () => {
      const { accountMenu } = setup({ isAuthenticated: false, isFeedbackLoopEnabled: true });

      expect(accountMenu.mock.calls[0][0]).toEqual(expect.objectContaining({ onSendFeedback: undefined }));
    });
  });

  it("shows Referrals when the affiliate program is enabled and the caller has a profile", async () => {
    setup({ isAuthenticated: true, isAffiliateProgramEnabled: true, hasAffiliateProfile: true });

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("menuitem", { name: "Referrals" })).toHaveAttribute("href", "/referrals");
  });

  function setup(input: {
    isAuthenticated?: boolean;
    minimal?: boolean;
    pathname?: string;
    isCommandMenuEnabled?: boolean;
    projectsEnabled?: boolean;
    isFeedbackLoopEnabled?: boolean;
    isAffiliateProgramEnabled?: boolean;
    hasAffiliateProfile?: boolean;
  }) {
    const accountMenu = vi.fn<typeof DEPENDENCIES.TopNavAccountMenu>(() => <></>);
    const openWhatsNew = vi.fn<ReturnType<typeof DEPENDENCIES.useOpenWhatsNew>>();
    const whatsNewAutoOpen = vi.fn<typeof DEPENDENCIES.WhatsNewAutoOpen>(() => null);
    const enabledFlags = {
      ui_command_menu: input.isCommandMenuEnabled ?? false,
      user_feedback_loop: input.isFeedbackLoopEnabled ?? false,
      affiliate_program: input.isAffiliateProgramEnabled ?? false
    };
    const openAssistant = vi.fn();
    const commandMenu = vi.fn<typeof DEPENDENCIES.CommandMenu>(() => <button type="button">Search or run a command</button>);
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(flag => enabledFlags[flag as keyof typeof enabledFlags] ?? false);
    const organizationSwitcher = vi.fn<typeof DEPENDENCIES.OrganizationSwitcher>(() => <button type="button">Switch organization</button>);
    const createOrganizationDialog = vi.fn<typeof DEPENDENCIES.CreateOrganizationDialog>(({ onClose }) => (
      <div role="dialog" aria-label="Create organization dialog">
        <button type="button" onClick={onClose}>
          Close dialog
        </button>
      </div>
    ));

    const sendFeedbackDialog = vi.fn<typeof DEPENDENCIES.SendFeedbackDialog>(({ onClose }) => (
      <div role="dialog" aria-label="Send feedback dialog">
        <button type="button" onClick={onClose}>
          Close feedback
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
      CommandMenu: commandMenu,
      useAssistantPanel: () => ({ isOpen: false, request: {}, openedAt: 0, open: openAssistant, close: vi.fn() }),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          organizations: [],
          activeOrganization: undefined,
          projectsEnabled: input.projectsEnabled ?? false
        }),
      useAffiliateProfileQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), {
          data: input.hasAffiliateProfile ? { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 } } : null
        }),
      TopNavAccountMenu: accountMenu,
      ActivityBell: () => <button type="button">Activity</button>,
      OrganizationSwitcher: organizationSwitcher,
      CreateOrganizationDialog: createOrganizationDialog,
      SendFeedbackDialog: sendFeedbackDialog,
      useOpenWhatsNew: () => openWhatsNew,
      WhatsNewAutoOpen: whatsNewAutoOpen
    });

    render(<TopNav dependencies={dependencies} minimal={input.minimal} />);

    return { accountMenu, useFlag, organizationSwitcher, openWhatsNew, whatsNewAutoOpen, openAssistant, commandMenu };
  }
});
