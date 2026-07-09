import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, RequireOnboarding } from "./RequireOnboarding";

import { render, screen } from "@testing-library/react";

describe(RequireOnboarding.name, () => {
  describe("flag on", () => {
    it("shows loading until wallet and leases resolve", () => {
      setup({ flag: true, isWalletLoading: true, path: "/deployments" });
      expect(screen.queryByText("child")).not.toBeInTheDocument();
    });

    it("renders children for an onboarded user on an app route", () => {
      setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 1, path: "/deployments" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("redirects a not-onboarded user off an app route to /onboarding", () => {
      const { replace } = setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 0, path: "/deployments" });
      expect(replace).toHaveBeenCalledWith("/onboarding");
      expect(screen.queryByText("child")).not.toBeInTheDocument();
    });

    it("redirects a user with no wallet to /onboarding", () => {
      const { replace } = setup({ flag: true, hasManagedWallet: false, path: "/deployments" });
      expect(replace).toHaveBeenCalledWith("/onboarding");
    });

    it("lets a not-onboarded user stay on the configure route", () => {
      setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 0, path: "/new-deployment/configure" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("lets a not-onboarded user stay on a deployment detail route", () => {
      setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 0, path: "/deployments/123" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("lets a not-onboarded user render the onboarding picker", () => {
      setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 0, path: "/onboarding" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("keeps an allow-list route mounted while leases load after the wallet arrives (no loader flash / remount mid-deploy)", () => {
      const { replace } = setup({ flag: true, address: "akash1", hasManagedWallet: true, leasesLoading: true, path: "/new-deployment/configure" });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("still waits for leases on a non-allow-list route while they load", () => {
      setup({ flag: true, address: "akash1", hasManagedWallet: true, leasesLoading: true, path: "/deployments" });
      expect(screen.queryByText("child")).not.toBeInTheDocument();
    });

    it("renders in place when the leases query errors instead of ejecting the user to onboarding", () => {
      const { replace } = setup({ flag: true, address: "akash1", hasManagedWallet: true, leasesError: true, path: "/deployments" });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("redirects an onboarded user away from /onboarding to returnTo", () => {
      const { replace } = setup({ flag: true, address: "akash1", hasManagedWallet: true, leases: 1, path: "/onboarding", returnTo: "/deployments" });
      expect(replace).toHaveBeenCalledWith("/deployments");
    });

    it("never gates a public page, even for a logged-out visitor", () => {
      const { replace } = setup({ flag: true, isPublic: true, loggedOut: true, path: "/faq" });
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByText("child")).toBeInTheDocument();
    });
  });

  describe("flag off (legacy has-wallet behavior)", () => {
    it("redirects an authed user without a wallet to /signup", () => {
      const { replace } = setup({ flag: false, userId: "u1", hasManagedWallet: false, isWalletConnected: false, path: "/deployments" });
      expect(replace).toHaveBeenCalledWith("/signup?returnTo=/deployments");
    });

    it("renders children on an excluded prefix without waiting", () => {
      setup({ flag: false, userId: "u1", hasManagedWallet: false, path: "/onboarding" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("renders children for a user with a wallet", () => {
      setup({ flag: false, userId: "u1", hasManagedWallet: true, path: "/deployments" });
      expect(screen.getByText("child")).toBeInTheDocument();
    });
  });

  function setup(input: {
    flag: boolean;
    path: string;
    isPublic?: boolean;
    loggedOut?: boolean;
    userId?: string;
    address?: string;
    hasManagedWallet?: boolean;
    isWalletConnected?: boolean;
    isWalletLoading?: boolean;
    leases?: number;
    leasesLoading?: boolean;
    leasesError?: boolean;
    returnTo?: string;
  }) {
    const replace = vi.fn();
    const d: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: (() => input.flag) as typeof DEPENDENCIES.useFlag,
      useUser: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: input.loggedOut ? undefined : ({ userId: input.userId ?? "u1" } as never),
          isLoading: false
        })) as typeof DEPENDENCIES.useUser,
      useWallet: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
          address: input.address ?? "",
          hasManagedWallet: input.hasManagedWallet ?? false,
          isWalletConnected: input.isWalletConnected ?? false,
          isWalletLoading: input.isWalletLoading ?? false
        })) as typeof DEPENDENCIES.useWallet,
      useAllLeases: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>({
          data: input.leasesError ? (undefined as never) : input.leases ? (Array.from({ length: input.leases }) as never) : [],
          isLoading: (input.leasesLoading ?? false) as never,
          isError: (input.leasesError ?? false) as never
        })) as typeof DEPENDENCIES.useAllLeases,
      useReturnTo: (() => mock<ReturnType<typeof DEPENDENCIES.useReturnTo>>({ returnTo: input.returnTo ?? "/" })) as typeof DEPENDENCIES.useReturnTo,
      useRouter: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ asPath: input.path, pathname: input.path, replace })) as typeof DEPENDENCIES.useRouter,
      UrlService: {
        ...DEPENDENCIES.UrlService,
        onboarding: (({ returnTo } = {}) => `/signup?returnTo=${returnTo}`) as typeof DEPENDENCIES.UrlService.onboarding
      }
    };
    render(
      <RequireOnboarding isPublic={input.isPublic} dependencies={d}>
        <div>child</div>
      </RequireOnboarding>
    );
    return { replace };
  }
});
