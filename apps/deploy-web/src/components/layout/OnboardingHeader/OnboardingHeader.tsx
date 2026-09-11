"use client";
import type { ReactNode } from "react";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { AccountMenu } from "@src/components/layout/AccountMenu";

export const DEPENDENCIES = { AccountMenu };

type Props = {
  children?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

/** Shared by the onboarding picker and the fair use policy step, so accepting the policy does not shift the chrome. */
export function OnboardingHeader({ children, dependencies: d = DEPENDENCIES }: Props) {
  return (
    <header className="relative flex items-center justify-between border-b border-border">
      <div className="flex h-14 w-full items-center justify-between pl-4 pr-4">
        <AkashConsoleLogo />
        <div className="flex items-center gap-2">
          {children}
          <d.AccountMenu minimal />
        </div>
      </div>
    </header>
  );
}
