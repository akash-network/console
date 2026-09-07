"use client";
import type { ReactNode } from "react";

import { FairUsePolicyModal } from "@src/components/fair-use-policy/FairUsePolicyModal/FairUsePolicyModal";
import { useWallet } from "@src/context/WalletProvider";
import { useAcceptFairUsePolicy } from "@src/hooks/useAcceptFairUsePolicy";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = {
  useUser,
  useWallet,
  useFlag,
  useAcceptFairUsePolicy,
  FairUsePolicyModal
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing), which never demand acceptance. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Keeps the page mounted behind a non-dismissible modal until a trialing user has accepted the Fair Use Policy once.
 * Mirrors the server gate, which only refuses deployments from trial wallets and only while the same flag is on.
 */
export function RequireFairUsePolicy({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  const { user } = d.useUser();
  const { isTrialing } = d.useWallet();
  const isGateEnabled = d.useFlag("fair_use_policy_gate");
  const { accept, isAccepting, hasAccepted } = d.useAcceptFairUsePolicy();
  const mustAccept = !isPublic && isGateEnabled && isTrialing && !!user?.userId && !user.fairUsePolicyAcceptedAt && !hasAccepted;

  return (
    <>
      {children}
      {mustAccept && <d.FairUsePolicyModal onAccept={accept} isAccepting={isAccepting} />}
    </>
  );
}
