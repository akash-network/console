import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, RequireOnboarding } from "./RequireOnboarding";

import { render, screen } from "@testing-library/react";

const SKIPPED_AT = "2026-07-27T00:00:00.000Z";

describe(RequireOnboarding.name, () => {
  it("renders the configure page for a user with no wallet instead of a full-screen loader", () => {
    setup({ hasWallet: false, path: "/new-deployment/configure" });
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders children for an onboarded user on an app route", () => {
    setup({ address: "akash1", hasWallet: true, leases: 1, path: "/deployments" });
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("redirects a not-onboarded user off an app route to /onboarding", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path: "/deployments" });
    expect(replace).toHaveBeenCalledWith("/onboarding");
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("redirects a user with no wallet to /onboarding", () => {
    const { replace } = setup({ hasWallet: false, path: "/deployments" });
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("lets a not-onboarded user stay on the configure route", () => {
    setup({ address: "akash1", hasWallet: true, leases: 0, path: "/new-deployment/configure" });
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("lets a not-onboarded user stay on a deployment detail route", () => {
    setup({ address: "akash1", hasWallet: true, leases: 0, path: "/deployments/123" });
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("lets a not-onboarded user reach billing, where the trial converts", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path: "/billing" });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("lets a not-onboarded user render the onboarding picker", () => {
    setup({ address: "akash1", hasWallet: true, leases: 0, path: "/onboarding" });
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("keeps an allow-list route mounted while leases load after the wallet arrives (no loader flash / remount mid-deploy)", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leasesLoading: true, path: "/new-deployment/configure" });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the same onboarding picker instance mounted when the trial wallet address arrives mid-provisioning (no loader flash / remount)", () => {
    // Render the picker before the trial wallet has an address, then have the address arrive while leases load —
    // the exact regression this PR fixes. The child must never unmount/remount and we must never redirect.
    const { replace, getChildMountCount, rerender } = setup({
      hasWallet: true,
      address: "",
      path: "/onboarding"
    });
    expect(screen.getByText("child")).toBeInTheDocument();
    const mountsBeforeWallet = getChildMountCount();

    rerender({ address: "akash1", hasWallet: true, leasesLoading: true });

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(getChildMountCount()).toBe(mountsBeforeWallet);
    expect(replace).not.toHaveBeenCalled();
  });

  it("still waits for leases on a non-allow-list route while they load", () => {
    setup({ address: "akash1", hasWallet: true, leasesLoading: true, path: "/deployments" });
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders in place when the leases query errors instead of ejecting the user to onboarding", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leasesError: true, path: "/deployments" });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an onboarded user away from /onboarding to returnTo", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leases: 1, path: "/onboarding", returnTo: "/deployments" });
    expect(replace).toHaveBeenCalledWith("/deployments");
  });

  it("never gates a public page, even for a logged-out visitor", () => {
    const { replace } = setup({ isPublic: true, loggedOut: true, path: "/faq" });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders children for a skipped user on an app route with no leases", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path: "/deployments", onboardingSkippedAt: SKIPPED_AT });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a skipped user away from /onboarding to returnTo", () => {
    const { replace } = setup({
      address: "akash1",
      hasWallet: true,
      leases: 0,
      path: "/onboarding",
      returnTo: "/deployments",
      onboardingSkippedAt: SKIPPED_AT
    });
    expect(replace).toHaveBeenCalledWith("/deployments");
  });

  it("renders a skipped user immediately on an app route without waiting for leases", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leasesLoading: true, path: "/deployments", onboardingSkippedAt: SKIPPED_AT });
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  function setup(input: {
    path: string;
    isPublic?: boolean;
    loggedOut?: boolean;
    userId?: string;
    address?: string;
    hasWallet?: boolean;
    leases?: number;
    leasesLoading?: boolean;
    leasesError?: boolean;
    returnTo?: string;
    onboardingSkippedAt?: string | null;
  }) {
    const replace = vi.fn();
    let mountCount = 0;
    // Counts DOM mounts of the gated child so a test can prove the child instance survives a wallet-arrival
    // transition (no unmount/remount) rather than only checking final presence.
    function Child() {
      useEffect(() => {
        mountCount += 1;
      }, []);
      return <div>child</div>;
    }

    const buildDependencies = (props: typeof input): typeof DEPENDENCIES => ({
      ...DEPENDENCIES,
      useUser: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: props.loggedOut ? undefined : mock<CustomUserProfile>({ userId: props.userId ?? "u1", onboardingSkippedAt: props.onboardingSkippedAt ?? null }),
          isLoading: false
        })) as typeof DEPENDENCIES.useUser,
      useWallet: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
          address: props.address ?? "",
          hasWallet: props.hasWallet ?? false
        })) as typeof DEPENDENCIES.useWallet,
      useLeaseExistenceQuery: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>({
          data: (props.leasesError ? undefined : (props.leases ?? 0) > 0) as never,
          isLoading: (props.leasesLoading ?? false) as never,
          isError: (props.leasesError ?? false) as never
        })) as typeof DEPENDENCIES.useLeaseExistenceQuery,
      useReturnTo: (() => mock<ReturnType<typeof DEPENDENCIES.useReturnTo>>({ returnTo: props.returnTo ?? "/" })) as typeof DEPENDENCIES.useReturnTo,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ asPath: props.path, pathname: props.path, replace })) as typeof DEPENDENCIES.useRouter
    });

    const renderGate = (props: typeof input) => (
      <RequireOnboarding isPublic={props.isPublic} dependencies={buildDependencies(props)}>
        <Child />
      </RequireOnboarding>
    );

    const { rerender } = render(renderGate(input));

    return {
      replace,
      getChildMountCount: () => mountCount,
      rerender: (patch: Partial<typeof input>) => rerender(renderGate({ ...input, ...patch }))
    };
  }
});
