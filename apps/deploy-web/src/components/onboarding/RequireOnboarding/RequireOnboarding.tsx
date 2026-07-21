"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { useAllLeases } from "@src/queries/useLeaseQuery";

const ONBOARDING_ROUTE = "/onboarding";

type GateDecision = "loading" | "render" | "toOnboarding" | "toReturn";

/** A not-yet-onboarded user may stay on these routes (they deploy their first app here). */
const ONBOARDING_ALLOWED_PREFIXES = ["/new-deployment/configure"];

export const DEPENDENCIES = {
  useUser,
  useWallet,
  useAllLeases,
  useReturnTo,
  useRouter
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing). Public pages are never onboarding-gated. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export function RequireOnboarding({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  return (
    <LeaseBasedGate isPublic={isPublic} dependencies={d}>
      {children}
    </LeaseBasedGate>
  );
}

/** `true` for `/deployments/{dseq}` detail routes (numeric dseq) — not the `/deployments` list. */
function isDeploymentDetail(path: string) {
  return /^\/deployments\/\d+/.test(path);
}

function LeaseBasedGate({
  children,
  isPublic,
  dependencies: d
}: Required<Pick<Props, "children">> & { isPublic?: boolean; dependencies: typeof DEPENDENCIES }) {
  const router = d.useRouter();
  const { user, isLoading: isUserLoading } = d.useUser();
  const { address, hasManagedWallet, isWalletInitializing } = d.useWallet();
  const { returnTo } = d.useReturnTo({ defaultReturnTo: "/" });

  const hasWallet = hasManagedWallet && !!address;
  const leasesQuery = d.useAllLeases(address, { enabled: hasWallet });
  const isLeasesLoading = hasWallet && leasesQuery.isLoading;
  const leasesErrored = hasWallet && leasesQuery.isError;
  const isOnboarded = hasWallet && (leasesQuery.data?.length ?? 0) > 0;

  const path = router.asPath.split("?")[0];
  const isOnOnboarding = path === ONBOARDING_ROUTE;
  const isAllowed = ONBOARDING_ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix)) || isDeploymentDetail(path);
  const identityKnown = !isUserLoading && !isWalletInitializing;
  const leasesSettled = !isLeasesLoading;

  const decision = decideLeaseGate({
    isPublic: !!isPublic,
    identityKnown,
    leasesSettled,
    leasesErrored,
    isAuthenticated: !!user?.userId,
    isOnboarded,
    isOnOnboarding,
    isAllowed
  });

  useEffect(
    function routeByOnboardingState() {
      if (decision === "toOnboarding") router.replace(ONBOARDING_ROUTE);
      else if (decision === "toReturn") router.replace(returnTo);
    },
    [decision, returnTo, router]
  );

  if (decision === "render") return <>{children}</>;
  return <Loading text="" />;
}

/**
 * Resolves the lease-based gate's action, in priority order. Public pages always render (RequireAuth owns auth).
 * Allow-list pages (configure, a deployment detail) render *immediately*, ahead of the identity/wallet wait and
 * the leases query, because they own their own loading UX (e.g. the auto-deploy progress overlay). The
 * `/onboarding` picker likewise renders once identity is known without waiting for leases: its trial wallet
 * provisions in the background, and the leases query flips to loading the moment that wallet's address appears,
 * which would otherwise flash the full-screen loader and remount the page (including an open Add Credits sheet).
 * An already-onboarded user who lands on `/onboarding` is still sent back where they came from, but only once
 * leases resolve (they render the picker until then). Everywhere else first waits until user + wallet identity is
 * known, then for leases to settle: an onboarded user renders, a not-onboarded user is sent to `/onboarding`. A
 * leases *error* leaves onboarding unknowable (an undefined result is not "no leases"), so we fail open and render
 * where the user is rather than eject a genuinely onboarded user into the first-deploy funnel on a transient
 * chain-API blip.
 */
function decideLeaseGate(input: {
  isPublic: boolean;
  identityKnown: boolean;
  leasesSettled: boolean;
  leasesErrored: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isOnOnboarding: boolean;
  isAllowed: boolean;
}): GateDecision {
  if (input.isPublic) return "render";
  if (input.isAllowed) return "render";
  if (!input.identityKnown) return "loading";
  if (!input.isAuthenticated) return "render";
  if (input.isOnboarded) return input.isOnOnboarding ? "toReturn" : "render";
  if (input.isOnOnboarding) return "render";
  if (!input.leasesSettled) return "loading";
  if (input.leasesErrored) return "render";
  return "toOnboarding";
}
