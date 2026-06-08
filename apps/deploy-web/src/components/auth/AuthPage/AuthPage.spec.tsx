import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AuthPage";
import { AuthPage } from "./AuthPage";

import { render, screen } from "@testing-library/react";

describe(AuthPage.name, () => {
  it("renders PasswordAuth when console_auth_passwordless is off", () => {
    setup({ isPasswordless: false });
    expect(screen.getByTestId("password")).toBeInTheDocument();
    expect(screen.queryByTestId("passwordless")).not.toBeInTheDocument();
  });

  it("renders PasswordlessAuth when console_auth_passwordless is on", () => {
    setup({ isPasswordless: true });
    expect(screen.getByTestId("passwordless")).toBeInTheDocument();
    expect(screen.queryByTestId("password")).not.toBeInTheDocument();
  });

  function setup(input: { isPasswordless: boolean }) {
    const dependencies: typeof DEPENDENCIES = {
      AuthLayout: (({ children }: { children?: React.ReactNode }) => <div data-testid="layout">{children}</div>) as never,
      H100PriceStatus: (() => <div data-testid="h100" />) as never,
      NextSeo: (() => null) as never,
      PasswordAuth: vi.fn(() => <div data-testid="password" />) as never,
      PasswordlessAuth: vi.fn(() => <div data-testid="passwordless" />) as never,
      useFlag: (() => input.isPasswordless) as never
    };
    render(<AuthPage dependencies={dependencies} />);
  }
});
