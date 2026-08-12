import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, TopNav } from "./TopNav";

import { render, screen } from "@testing-library/react";
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
  });

  it("marks Deployments active on the new deployment flow", () => {
    setup({ isAuthenticated: true, pathname: "/new-deployment/configure" });

    expect(screen.getByRole("link", { name: "Deployments" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark a link active for a route that only shares its prefix", () => {
    setup({ isAuthenticated: true, pathname: "/providers-old" });

    expect(screen.getByRole("link", { name: "Providers" })).not.toHaveAttribute("aria-current");
  });

  it("shows all settings items", async () => {
    setup({ isAuthenticated: true });

    await userEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("menuitem", { name: "Billing" })).toHaveAttribute("href", "/billing");
    expect(screen.getByRole("menuitem", { name: "API Keys" })).toHaveAttribute("href", "/user/api-keys");
    expect(screen.getByRole("menuitem", { name: "Usage" })).toHaveAttribute("href", "/usage");
    expect(screen.getByRole("menuitem", { name: "Alerts" })).toHaveAttribute("href", "/alerts");
  });

  function setup(input: { isAuthenticated?: boolean; minimal?: boolean; pathname?: string }) {
    const accountMenu = vi.fn<typeof DEPENDENCIES.TopNavAccountMenu>(() => <></>);

    const dependencies = MockComponents(DEPENDENCIES, {
      useUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: input.isAuthenticated ? { userId: "user-1" } : undefined
        }),
      usePathname: () => input.pathname ?? "/",
      useCookieTheme: () => "light",
      TopNavAccountMenu: accountMenu
    });

    render(<TopNav dependencies={dependencies} minimal={input.minimal} />);

    return { accountMenu };
  }
});
