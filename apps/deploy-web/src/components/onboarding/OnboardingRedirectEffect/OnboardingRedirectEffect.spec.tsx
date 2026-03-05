import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EXCLUDED_PREFIXES, OnboardingRedirectEffect } from "./OnboardingRedirectEffect";

import { render } from "@testing-library/react";

describe(OnboardingRedirectEffect.name, () => {
  it("redirects to onboarding when user has userId but no wallet", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: "/deployments"
    });

    expect(mockRouter.replace).toHaveBeenCalledWith("/signup?return-to=%2Fdeployments");
  });

  it("does not redirect when user has a managed wallet", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: true, isWalletConnected: false },
      pathname: "/deployments"
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when wallet is connected", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: true },
      pathname: "/deployments"
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when user has no userId", () => {
    const { mockRouter } = setup({
      user: {},
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: "/deployments"
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when user is loading", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: "/deployments",
      isUserLoading: true
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when wallet is loading", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: "/deployments",
      isWalletLoading: true
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it.each(EXCLUDED_PREFIXES)("does not redirect when pathname starts with %s", prefix => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: prefix
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("passes returnTo with router.asPath", () => {
    const { mockRouter } = setup({
      user: { userId: "user-1" },
      wallet: { hasManagedWallet: false, isWalletConnected: false },
      pathname: "/deployments",
      asPath: "/deployments?page=2"
    });

    expect(mockRouter.replace).toHaveBeenCalledWith("/signup?return-to=%2Fdeployments%3Fpage%3D2");
  });

  function setup(input: {
    user?: { userId?: string };
    wallet?: { hasManagedWallet?: boolean; isWalletConnected?: boolean };
    pathname?: string;
    asPath?: string;
    isUserLoading?: boolean;
    isWalletLoading?: boolean;
  }) {
    const mockRouter = {
      pathname: input.pathname || "/",
      asPath: input.asPath || input.pathname || "/",
      replace: vi.fn()
    };

    const dependencies = {
      useUser: vi.fn().mockReturnValue({
        user: input.user || {},
        isLoading: input.isUserLoading || false
      }),
      useWallet: vi.fn().mockReturnValue({
        hasManagedWallet: input.wallet?.hasManagedWallet || false,
        isWalletConnected: input.wallet?.isWalletConnected || false,
        isWalletLoading: input.isWalletLoading || false
      }),
      useRouter: vi.fn().mockReturnValue(mockRouter),
      UrlService: {
        onboarding: vi.fn(({ returnTo }: { returnTo?: string } = {}) => {
          if (returnTo) {
            return `/signup?return-to=${encodeURIComponent(returnTo)}`;
          }
          return "/signup";
        })
      }
    } as unknown as ComponentProps<typeof OnboardingRedirectEffect>["dependencies"];

    render(<OnboardingRedirectEffect dependencies={dependencies} />);

    return { mockRouter, dependencies };
  }
});
