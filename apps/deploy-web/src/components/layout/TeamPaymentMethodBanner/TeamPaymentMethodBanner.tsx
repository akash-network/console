"use client";
import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { CreditCard } from "lucide-react";

import { BillingActionsProvider, useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { canManageBilling } from "@src/components/organizations/organizationAccess";
import { useTeamWithoutPaymentMethod } from "@src/hooks/useTeamWithoutPaymentMethod";

export const DEPENDENCIES = { useTeamWithoutPaymentMethod, useBillingActions, BillingActionsProvider };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function TeamPaymentMethodBanner({ dependencies: d = DEPENDENCIES }: Props) {
  const team = d.useTeamWithoutPaymentMethod();

  if (!team) return null;

  const canSetUpBilling = canManageBilling(team.role);

  return (
    <div className="bg-background">
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-[13px] text-amber-800 md:px-6 dark:text-amber-300"
      >
        <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
          <CreditCard className="mt-px h-4 w-4 flex-shrink-0" aria-hidden />
          <span className="min-w-0 leading-snug">
            <span className="font-semibold">{team.name} has no payment method.</span>{" "}
            {canSetUpBilling
              ? "Add one so your team can deploy. Organization billing is separate from your personal account."
              : "No one can deploy until an owner or a billing member adds one."}
          </span>
        </div>
        {canSetUpBilling && (
          <d.BillingActionsProvider>
            <SetUpBillingButton dependencies={d} />
          </d.BillingActionsProvider>
        )}
      </div>
    </div>
  );
}

function SetUpBillingButton({ dependencies: d }: Required<Props>) {
  const { openAddPaymentMethod } = d.useBillingActions();

  return (
    <Button variant="outline" size="sm" className="flex-shrink-0 text-foreground" onClick={() => openAddPaymentMethod()}>
      Set up billing
    </Button>
  );
}
