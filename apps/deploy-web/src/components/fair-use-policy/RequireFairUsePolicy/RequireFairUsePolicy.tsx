"use client";
import type { ReactNode } from "react";

import { FairUsePolicyModal } from "@src/components/fair-use-policy/FairUsePolicyModal/FairUsePolicyModal";
import { useAcceptFairUsePolicy } from "@src/hooks/useAcceptFairUsePolicy";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = {
  useUser,
  useAcceptFairUsePolicy,
  FairUsePolicyModal
};

type Props = {
  children: ReactNode;
  /** True on `definePublicPage` routes (login/signup/marketing), which never demand acceptance. */
  isPublic?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** Keeps the page mounted behind a non-dismissible modal until a signed-in user has accepted the Fair Use Policy once. */
export function RequireFairUsePolicy({ children, isPublic, dependencies: d = DEPENDENCIES }: Props) {
  const { user } = d.useUser();
  const { accept, isAccepting } = d.useAcceptFairUsePolicy();
  const mustAccept = !isPublic && !!user?.userId && !user.fairUsePolicyAcceptedAt;

  return (
    <>
      {children}
      {mustAccept && <d.FairUsePolicyModal onAccept={accept} isAccepting={isAccepting} />}
    </>
  );
}
