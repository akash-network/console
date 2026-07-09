"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { UrlService } from "@src/utils/urlUtils";

const ONBOARDING_ROUTE = "/onboarding";

type GateDecision = "loading" | "render" | "toOnboarding" | "toReturn";

/** While the redesign flag is on, a not-yet-onboarded user may stay on these routes (they deploy their first app here). */
const ONBOARDING_ALLOWED_PREFIXES = ["/new-deployment/configure"];

/** Legacy (flag-off) redirect never touches these prefixes. Mirrors the removed OnboardingRedirectEffect. */
const WALLET_GATE_EXCLUDED_PREFIXES = ["/signup", "/onboarding", "/login", "/api/", "/user/verify-email"];

export const DEPENDENCIES = {
  useFlag,
  useUser,
  useWallet,
  useAllLeases,
  useReturnTo,
  useRouter,
  UrlService
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing). Public pages are never onboarding-gated. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export function RequireOnboarding({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  const isRedesignEnabled = d.useFlag("onboarding_redesign_v1");
  return isRedesignEnabled ? (
    <LeaseBasedGate isPublic={isPublic} dependencies={d}>
      {children}
    </LeaseBasedGate>
  ) : (
    <WalletBasedGate dependencies={d}>{children}</WalletBasedGate>
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
  const { address, hasManagedWallet, isWalletLoading } = d.useWallet();
  const { returnTo } = d.useReturnTo({ defaultReturnTo: "/" });

  const hasWallet = hasManagedWallet && !!address;
  const leasesQuery = d.useAllLeases(address, { enabled: hasWallet });
  const isLeasesLoading = hasWallet && leasesQuery.isLoading;
  const leasesErrored = hasWallet && leasesQuery.isError;
  const isOnboarded = hasWallet && (leasesQuery.data?.length ?? 0) > 0;

  const path = router.asPath.split("?")[0];
  const isOnOnboarding = path === ONBOARDING_ROUTE;
  const isAllowed = ONBOARDING_ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix)) || isDeploymentDetail(path);
  const identityKnown = !isUserLoading && !isWalletLoading;
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
 * Resolves the lease-based gate's action, in priority order: public pages and logged-out visitors always render
 * (RequireAuth owns auth); wait only until user + wallet identity is known. Allow-list pages (configure, a
 * deployment detail) render for any authenticated user — onboarded or not — so they render *without* waiting on
 * the leases query. That keeps such a page mounted when the trial wallet arrives and newly enables that query,
 * instead of flashing the loader and remounting an in-progress deploy. Everywhere else waits for leases to
 * settle: an onboarded user renders except on `/onboarding` (sent back where they came from), and a
 * not-onboarded user renders on `/onboarding` but is sent there from anywhere else. A leases *error* leaves
 * onboarding unknowable — an undefined result is not "no leases" — so we fail open and render where the user is
 * rather than eject a genuinely onboarded user into the first-deploy funnel on a transient chain-API blip.
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
  if (!input.identityKnown) return "loading";
  if (!input.isAuthenticated) return "render";
  if (input.isAllowed) return "render";
  if (!input.leasesSettled) return "loading";
  if (input.isOnboarded) return input.isOnOnboarding ? "toReturn" : "render";
  if (input.isOnOnboarding) return "render";
  if (input.leasesErrored) return "render";
  return "toOnboarding";
}

function WalletBasedGate({ children, dependencies: d }: Required<Pick<Props, "children">> & { dependencies: typeof DEPENDENCIES }) {
  const router = d.useRouter();
  const { user, isLoading: isUserLoading } = d.useUser();
  const { hasManagedWallet, isWalletConnected, isWalletLoading } = d.useWallet();

  const isExcluded = WALLET_GATE_EXCLUDED_PREFIXES.some(prefix => router.pathname.startsWith(prefix));
  const stateKnown = !isUserLoading && !isWalletLoading;
  const needsOnboarding = !!user?.userId && !hasManagedWallet && !isWalletConnected;

  const decision = isExcluded ? "render" : !stateKnown ? "loading" : needsOnboarding ? "toOnboarding" : "render";

  useEffect(
    function redirectRegisteredUserWithoutWalletToOnboarding() {
      if (decision === "toOnboarding") router.replace(d.UrlService.onboarding({ returnTo: router.asPath }));
    },
    [decision, router, d.UrlService]
  );

  if (decision === "render") return <>{children}</>;
  return <Loading text="" />;
}
