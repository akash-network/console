import React from "react";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, SignUpButton } from "./SignUpButton";

import { fireEvent, render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(SignUpButton.name, () => {
  it("renders with default text when no children provided", () => {
    setup();

    expect(screen.getByText("Sign up")).toBeInTheDocument();
  });

  it("renders with custom children content", () => {
    setup({ children: "Custom Sign Up Text" });

    expect(screen.getByText("Custom Sign Up Text")).toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("renders as a link by default", () => {
    setup({ className: "custom-class", "data-testid": "signup-link", id: "signup-btn" });

    const linkElement = screen.queryByRole("link");
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveClass("custom-class");
    expect(linkElement).toHaveAttribute("data-testid", "signup-link");
    expect(linkElement).toHaveAttribute("id", "signup-btn");
    expect(linkElement).toHaveAttribute("href", `/login?tab=signup&returnTo=${encodeURIComponent("/")}`);
  });

  it("renders as a button when specified", () => {
    setup({ wrapper: "button", className: "custom-class", "data-testid": "signup-button", id: "signup-btn" });

    const buttonElement = screen.queryByRole("button");
    expect(buttonElement).toBeInTheDocument();
    expect(buttonElement).toHaveClass("custom-class");
    expect(buttonElement).toHaveAttribute("data-testid", "signup-button");
    expect(buttonElement).toHaveAttribute("id", "signup-btn");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls authService.loginViaOauth when clicked on button", async () => {
    const navigate = vi.fn();
    setup({ wrapper: "button", navigate });

    const buttonElement = screen.getByRole("button");
    fireEvent.click(buttonElement);

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(`/login?tab=signup&returnTo=${encodeURIComponent("/")}`);
    });
  });

  function setup({
    navigate,
    ...props
  }: Partial<React.ComponentProps<typeof SignUpButton>> & {
    navigate?: NextRouter["push"];
  } = {}) {
    const router = mock<NextRouter>({ push: navigate ?? vi.fn() });

    render(
      <TestContainerProvider>
        <SignUpButton {...props} dependencies={{ ...DEPENDENCIES, useRouter: () => router }} />
      </TestContainerProvider>
    );
  }
});
