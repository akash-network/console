import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AuthPage";
import { AuthPage } from "./AuthPage";

import { render, screen } from "@testing-library/react";

describe(AuthPage.name, () => {
  it("renders PasswordlessAuth by default", () => {
    setup({});
    expect(screen.getByTestId("passwordless")).toBeInTheDocument();
    expect(screen.queryByTestId("password")).not.toBeInTheDocument();
  });

  it("renders PasswordAuth when ?auth=password is present", () => {
    setup({ authParam: "password" });
    expect(screen.getByTestId("password")).toBeInTheDocument();
    expect(screen.queryByTestId("passwordless")).not.toBeInTheDocument();
  });

  it("strips the tab param without refresh when passwordless is shown", () => {
    const { replace } = setup({ tab: "signup" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]).toEqual([expect.not.stringContaining("tab"), undefined, { shallow: true }]);
  });

  it("keeps the tab param when the password form is shown", () => {
    const { replace } = setup({ authParam: "password", tab: "signup" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not touch the URL when passwordless is shown without a tab param", () => {
    const { replace } = setup({});
    expect(replace).not.toHaveBeenCalled();
  });

  function setup(input: { authParam?: string; tab?: string }) {
    const params = new URLSearchParams();
    if (input.authParam) params.set("auth", input.authParam);
    if (input.tab) params.set("tab", input.tab);
    const replace = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      AuthLayout: (({ children }: { children?: React.ReactNode }) => <div data-testid="layout">{children}</div>) as never,
      H100PriceStatus: (() => <div data-testid="h100" />) as never,
      NextSeo: (() => null) as never,
      PasswordAuth: vi.fn(() => <div data-testid="password" />) as never,
      PasswordlessAuth: vi.fn(() => <div data-testid="passwordless" />) as never,
      useRouter: (() => ({ replace, pathname: "/login" })) as never,
      useSearchParams: (() => params) as never
    };
    render(<AuthPage dependencies={dependencies} />);
    return { ...input, replace };
  }
});
