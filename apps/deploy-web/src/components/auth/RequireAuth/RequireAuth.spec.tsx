import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./RequireAuth";
import { RequireAuth } from "./RequireAuth";

import { render, screen } from "@testing-library/react";

describe(RequireAuth.name, () => {
  it("renders children when isPublic is true even without a user", () => {
    setup({ isPublic: true });
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("renders children when user is authenticated", () => {
    setup({ user: { userId: "u1" } });
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("does not render children when user is loading", () => {
    setup({ isUserLoading: true });
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("does not render children when loaded and unauthenticated on a gated route", () => {
    setup({});
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("redirects to /login with returnTo when loaded and unauthenticated", () => {
    const { mockRouter } = setup({ asPath: "/billing?x=1" });
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    const target = mockRouter.replace.mock.calls[0][0] as string;
    expect(target).toContain("/login");
    expect(target).toContain(encodeURIComponent("/billing?x=1"));
  });

  it("does not redirect while loading", () => {
    const { mockRouter } = setup({ isUserLoading: true });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when already on the login route", () => {
    const { mockRouter } = setup({ asPath: "/login?tab=login&returnTo=%2Fdeployments" });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when isPublic is true", () => {
    const { mockRouter } = setup({ isPublic: true });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when the user is authenticated", () => {
    const { mockRouter } = setup({ user: { userId: "u1" } });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  function setup(input: { isPublic?: boolean; user?: { userId?: string }; isUserLoading?: boolean; asPath?: string }) {
    const mockRouter = { asPath: input.asPath || "/", replace: vi.fn() };
    const urlService = mock<typeof DEPENDENCIES.UrlService>();
    urlService.newLogin.mockImplementation(({ returnTo }: { returnTo?: string } = {}) => `/login?tab=login&returnTo=${encodeURIComponent(returnTo || "/")}`);
    const dependencies = mock<typeof DEPENDENCIES>({
      useUser: vi.fn().mockReturnValue({ user: input.user, isLoading: input.isUserLoading || false, checkSession: vi.fn() }),
      useRouter: vi.fn().mockReturnValue(mockRouter),
      UrlService: urlService
    });

    render(
      <RequireAuth isPublic={input.isPublic} dependencies={dependencies}>
        <div>protected</div>
      </RequireAuth>
    );

    return { mockRouter, dependencies };
  }
});
