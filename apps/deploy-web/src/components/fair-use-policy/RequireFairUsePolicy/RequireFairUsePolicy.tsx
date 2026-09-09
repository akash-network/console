"use client";
import type { ReactNode } from "react";

import { FairUsePolicyModal } from "@src/components/fair-use-policy/FairUsePolicyModal/FairUsePolicyModal";
import Layout from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { useAcceptFairUsePolicy } from "@src/hooks/useAcceptFairUsePolicy";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = {
  useUser,
  useWallet,
  useFlag,
  useAcceptFairUsePolicy,
  Layout,
  FairUsePolicyModal
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing), which never demand acceptance. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** Holds the page back until acceptance, so an auto-started deployment cannot fire behind the modal, and renders the shell the withheld page would have. */
export function RequireFairUsePolicy({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  const { user } = d.useUser();
  const { isTrialing, hasWallet, isWalletLookupFailed } = d.useWallet();
  const isGateEnabled = d.useFlag("fair_use_policy_gate");
  const { accept, isAccepting, hasAccepted } = d.useAcceptFairUsePolicy();
  const isAwaitingTrialWallet = !hasWallet && !isWalletLookupFailed;
  const mustAccept = !isPublic && isGateEnabled && (isTrialing || isAwaitingTrialWallet) && !!user?.userId && !user.fairUsePolicyAcceptedAt && !hasAccepted;

  if (mustAccept) {
    return (
      <d.Layout>
        <d.FairUsePolicyModal onAccept={accept} isAccepting={isAccepting} />
      </d.Layout>
    );
  }

  return <>{children}</>;
}
