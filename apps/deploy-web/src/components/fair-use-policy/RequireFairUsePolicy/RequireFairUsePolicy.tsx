"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FairUsePolicyModal } from "@src/components/fair-use-policy/FairUsePolicyModal/FairUsePolicyModal";
import { FairUsePolicyStep } from "@src/components/fair-use-policy/FairUsePolicyStep/FairUsePolicyStep";
import Layout from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useAcceptFairUsePolicy } from "@src/hooks/useAcceptFairUsePolicy";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  useUser,
  useWallet,
  useFlag,
  useAcceptFairUsePolicy,
  usePathname,
  Layout,
  FairUsePolicyModal,
  FairUsePolicyStep
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing), which never demand acceptance. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** Holds the page back until acceptance, so an auto-started deployment cannot fire behind the prompt. */
export function RequireFairUsePolicy({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  const { user } = d.useUser();
  const { isTrialing, hasWallet, isWalletLookupFailed } = d.useWallet();
  const isGateEnabled = d.useFlag("fair_use_policy_gate");
  const { accept, isAccepting, hasAccepted } = d.useAcceptFairUsePolicy();
  /** Only a user who has never deployed can reach the onboarding route, so there the prompt belongs in the page flow rather than over it. */
  const isOnboardingRoute = d.usePathname() === UrlService.onboardingPicker();
  const isAwaitingTrialWallet = !hasWallet && !isWalletLookupFailed;
  const mustAccept = !isPublic && isGateEnabled && (isTrialing || isAwaitingTrialWallet) && !!user?.userId && !user.fairUsePolicyAcceptedAt && !hasAccepted;

  if (mustAccept) {
    if (isOnboardingRoute) {
      return <d.FairUsePolicyStep onAccept={accept} isAccepting={isAccepting} />;
    }

    return (
      <d.Layout>
        <d.FairUsePolicyModal onAccept={accept} isAccepting={isAccepting} />
      </d.Layout>
    );
  }

  return <>{children}</>;
}
