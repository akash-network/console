import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
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

  it("lets a not-onboarded user reach the projects page", () => {
    const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path: "/projects" });
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

  describe("in an organization", () => {
    it("renders a team organization on an app route although its wallet holds no lease", () => {
      const { replace } = setup({ address: "akash1team", hasWallet: true, leases: 0, path: "/deployments", organizationType: "team" });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("sends a team organization away from the trial onboarding to returnTo", () => {
      const { replace } = setup({ address: "akash1team", hasWallet: true, leases: 0, path: "/onboarding", returnTo: "/members", organizationType: "team" });
      expect(replace).toHaveBeenCalledWith("/members");
    });

    it("still sends a personal organization without a lease to /onboarding", () => {
      const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path: "/deployments", organizationType: "personal" });
      expect(replace).toHaveBeenCalledWith("/onboarding");
    });

    it("waits for the memberships before deciding where to send the user", () => {
      const { replace, rerender } = setup({ address: "akash1team", hasWallet: true, leases: 0, path: "/deployments", isOrganizationLoading: true });
      expect(replace).not.toHaveBeenCalled();
      expect(screen.queryByText("child")).not.toBeInTheDocument();

      rerender({ isOrganizationLoading: false, organizationType: "team" });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("keeps loading before the feature flags answer, while the organization is still unknown", () => {
      const { replace } = setup({ address: "akash1team", hasWallet: true, leases: 0, path: "/deployments", isOrganizationLoading: true });
      expect(replace).not.toHaveBeenCalledWith("/onboarding");
      expect(screen.queryByText("child")).not.toBeInTheDocument();
    });

    it("renders in place when the memberships cannot be loaded instead of ejecting the user to onboarding", () => {
      const { replace } = setup({ address: "akash1team", hasWallet: true, leases: 0, path: "/deployments", isOrganizationLookupFailed: true });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("still waits for leases when the memberships cannot be loaded", () => {
      const { replace } = setup({ address: "akash1", hasWallet: true, leasesLoading: true, path: "/deployments", isOrganizationLookupFailed: true });
      expect(screen.queryByText("child")).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it.each(["/invitations", "/members", "/projects/1234"])("lets a not-onboarded user reach %s", path => {
      const { replace } = setup({ address: "akash1", hasWallet: true, leases: 0, path, organizationType: "personal" });
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    organizationType?: OrganizationOutput["type"];
    isOrganizationLoading?: boolean;
    isOrganizationLookupFailed?: boolean;
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
      useRouter: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ asPath: props.path, pathname: props.path, replace })) as typeof DEPENDENCIES.useRouter,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: props.organizationType ? mock<OrganizationOutput>({ type: props.organizationType }) : undefined,
          isLoading: props.isOrganizationLoading ?? false,
          isError: props.isOrganizationLookupFailed ?? false
        })
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
