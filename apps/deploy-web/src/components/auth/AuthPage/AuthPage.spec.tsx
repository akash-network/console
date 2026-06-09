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

  it("renders PasswordAuth when the escape hatch is on and ?auth=password is present", () => {
    setup({ isPasswordless: true, canUsePassword: true, authParam: "password" });
    expect(screen.getByTestId("password")).toBeInTheDocument();
    expect(screen.queryByTestId("passwordless")).not.toBeInTheDocument();
  });

  it("ignores ?auth=password when the escape hatch is off", () => {
    setup({ isPasswordless: true, canUsePassword: false, authParam: "password" });
    expect(screen.getByTestId("passwordless")).toBeInTheDocument();
    expect(screen.queryByTestId("password")).not.toBeInTheDocument();
  });

  it("renders PasswordlessAuth when the escape hatch is on but the param is absent", () => {
    setup({ isPasswordless: true, canUsePassword: true });
    expect(screen.getByTestId("passwordless")).toBeInTheDocument();
    expect(screen.queryByTestId("password")).not.toBeInTheDocument();
  });

  it("strips the tab param without refresh when passwordless is shown", () => {
    const { replace } = setup({ isPasswordless: true, tab: "signup" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]).toEqual([expect.not.stringContaining("tab"), undefined, { shallow: true }]);
  });

  it("keeps the tab param when the password form is shown", () => {
    const { replace } = setup({ isPasswordless: true, canUsePassword: true, authParam: "password", tab: "signup" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not touch the URL when passwordless is shown without a tab param", () => {
    const { replace } = setup({ isPasswordless: true });
    expect(replace).not.toHaveBeenCalled();
  });

  function setup(input: { isPasswordless?: boolean; canUsePassword?: boolean; authParam?: string; tab?: string }) {
    const flags: Record<string, boolean> = {
      console_auth_passwordless: input.isPasswordless ?? false,
      console_auth_password_escape_hatch: input.canUsePassword ?? false
    };
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
      useFlag: ((flag: string) => flags[flag] ?? false) as never,
      useRouter: (() => ({ replace, pathname: "/login" })) as never,
      useSearchParams: (() => params) as never
    };
    render(<AuthPage dependencies={dependencies} />);
    return { ...input, replace };
  }
});
