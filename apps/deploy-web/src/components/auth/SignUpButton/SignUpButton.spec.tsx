import "@testing-library/jest-dom";

import React from "react";
import { mock } from "jest-mock-extended";

import type { AuthService } from "@src/services/auth/auth/auth.service";
import { SignUpButton } from "./SignUpButton";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(linkElement).toHaveAttribute("href", "#");
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

  it("calls authService.loginViaOauth when clicked on link", async () => {
    const signup = jest.fn(() => Promise.resolve());
    setup({ signup });

    const linkElement = screen.getByRole("link");
    fireEvent.click(linkElement);

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith();
    });
  });

  it("calls authService.loginViaOauth when clicked on button", async () => {
    const signup = jest.fn(() => Promise.resolve());
    setup({ wrapper: "button", signup });

    const buttonElement = screen.getByRole("button");
    fireEvent.click(buttonElement);

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith();
    });
  });

  function setup({
    signup,
    ...props
  }: Partial<React.ComponentProps<typeof SignUpButton>> & {
    signup?: AuthService["loginViaOauth"];
  } = {}) {
    const authService = mock<AuthService>({ loginViaOauth: signup });

    render(
      <TestContainerProvider services={{ authService: () => authService }}>
        <SignUpButton {...props} />
      </TestContainerProvider>
    );
  }
});
