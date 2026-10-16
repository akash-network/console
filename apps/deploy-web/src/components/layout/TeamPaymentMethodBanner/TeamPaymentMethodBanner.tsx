"use client";
import React from "react";
import { Banner, Button } from "@akashnetwork/ui/components";
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
    <Banner variant="warning" role="status">
      <CreditCard className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">{team.name} has no payment method.</span>{" "}
        {canSetUpBilling
          ? "Add one so your team can deploy. Organization billing is separate from your personal account."
          : "No one can deploy until an owner or a billing member adds one."}
      </span>
      {canSetUpBilling && (
        <d.BillingActionsProvider>
          <SetUpBillingButton dependencies={d} />
        </d.BillingActionsProvider>
      )}
    </Banner>
  );
}

function SetUpBillingButton({ dependencies: d }: Required<Props>) {
  const { openAddPaymentMethod } = d.useBillingActions();

  return (
    <Button variant="outline" size="xs" className="flex-shrink-0 text-foreground" onClick={() => openAddPaymentMethod()}>
      Set up billing
    </Button>
  );
}
