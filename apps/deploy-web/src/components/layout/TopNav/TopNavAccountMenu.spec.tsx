import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/services/auth/auth/auth.service";
import { DEPENDENCIES, TopNavAccountMenu } from "./TopNavAccountMenu";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(TopNavAccountMenu.name, () => {
  it("renders the spinner while loading", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /account menu/i })).not.toBeInTheDocument();
  });

  it("renders the user's initial when signed in", () => {
    setup({ username: "alice" });

    expect(screen.getByRole("button", { name: /account menu/i })).toHaveTextContent("A");
  });

  it("shows the signed-in items when opened", async () => {
    setup({ username: "alice" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Contact us")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("navigates to profile settings when Profile is selected", async () => {
    const { push } = setup({ username: "alice" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByText("Profile"));

    expect(push).toHaveBeenCalledWith("/user/settings");
  });

  it("opens the docs in a new tab when Docs is selected", async () => {
    const { windowOpen } = setup({ username: "alice" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByText("Docs"));

    expect(windowOpen).toHaveBeenCalledWith("https://akash.network/docs", "_blank", "noreferrer noopener");
  });

  it("calls authService.logout when Log out is selected", async () => {
    const { authService } = setup({ username: "bob" });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByText("Log out"));

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it("shows sign up and sign in when signed out", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("Sign up")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("shows only Log out in the minimal variant when signed in", async () => {
    setup({ username: "erin", minimal: true });

    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(await screen.findByText("Log out")).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Theme")).not.toBeInTheDocument();
    expect(screen.queryByText("Docs")).not.toBeInTheDocument();
    expect(screen.queryByText("Contact us")).not.toBeInTheDocument();
  });

  function setup(input: { isLoading?: boolean; username?: string; minimal?: boolean }) {
    const push = vi.fn();
    const authService = mock<AuthService>();
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      useCustomUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
          user: input.username ? { username: input.username, userId: "user-1" } : undefined,
          isLoading: input.isLoading ?? false
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push })
    });

    render(
      <TestContainerProvider services={{ authService: () => authService }}>
        <TopNavAccountMenu dependencies={dependencies} minimal={input.minimal} />
      </TestContainerProvider>
    );

    return { authService, push, windowOpen };
  }
});
