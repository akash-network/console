import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/services/auth/auth/auth.service";
import type { DEPENDENCIES } from "./AccountMenu";
import { AccountMenu } from "./AccountMenu";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildWallet } from "@tests/seeders/wallet";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AccountMenu.name, () => {
  it("renders the spinner while loading", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /account menu/i })).not.toBeInTheDocument();
  });

  it("renders the user's initial when signed in", () => {
    setup({ username: "alice" });

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger).toHaveTextContent("A");
  });

  it("opens the menu on click and shows signed-in items", async () => {
    setup({ username: "alice" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("opens the menu on click and shows signed-out items", async () => {
    setup({ username: undefined });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.queryByText("Profile Settings")).not.toBeInTheDocument();
  });

  it("calls authService.logout when Logout is selected", async () => {
    const { authService } = setup({ username: "bob" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByText("Logout"));

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it("shows Billing & Usage when flag, userId, and managed wallet are all present", async () => {
    setup({
      username: "carol",
      userId: "user-1",
      isManagedWallet: true,
      isBillingUsageEnabled: true
    });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("Billing & Usage")).toBeInTheDocument();
  });

  it("hides Billing & Usage when the flag is disabled", async () => {
    setup({
      username: "dan",
      userId: "user-1",
      isManagedWallet: true,
      isBillingUsageEnabled: false
    });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    await screen.findByText("Logout");
    expect(screen.queryByText("Billing & Usage")).not.toBeInTheDocument();
  });

  function setup(input: { isLoading?: boolean; username?: string; userId?: string; isManagedWallet?: boolean; isBillingUsageEnabled?: boolean }) {
    const push = vi.fn();
    const authService = mock<AuthService>();

    const dependencies: typeof DEPENDENCIES = {
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
          user: input.username ? { username: input.username, userId: input.userId } : undefined,
          isLoading: input.isLoading ?? false
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      useFlag: flagName => (flagName === "billing_usage" && input.isBillingUsageEnabled) ?? false,
      useWallet: () => buildWallet({ isManaged: input.isManagedWallet ?? false })
    };

    render(
      <TestContainerProvider services={{ authService: () => authService }}>
        <AccountMenu dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { authService, push };
  }
});
