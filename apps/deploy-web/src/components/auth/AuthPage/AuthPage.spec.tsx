import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AuthPage";
import { AuthPage } from "./AuthPage";

import { render, screen } from "@testing-library/react";

describe(AuthPage.name, () => {
  it("renders AuthPageLegacy when console_auth_redesign is off", () => {
    setup({ isRedesignEnabled: false });
    expect(screen.getByTestId("legacy")).toBeInTheDocument();
    expect(screen.queryByTestId("passwordless")).not.toBeInTheDocument();
  });

  it("renders AuthPagePasswordless when console_auth_redesign is on", () => {
    setup({ isRedesignEnabled: true });
    expect(screen.getByTestId("passwordless")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy")).not.toBeInTheDocument();
  });

  function setup(input: { isRedesignEnabled: boolean }) {
    const dependencies: typeof DEPENDENCIES = {
      AuthPageLegacy: vi.fn(() => <div data-testid="legacy" />) as never,
      AuthPagePasswordless: vi.fn(() => <div data-testid="passwordless" />) as never,
      useFlag: (() => input.isRedesignEnabled) as never
    };
    render(<AuthPage dependencies={dependencies} />);
  }
});
