"use client";
import type { FC } from "react";
import { useState } from "react";
import { Badge, Button, Card, Skeleton } from "@akashnetwork/ui/components";
import { FileText, Pencil } from "lucide-react";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { canManageBilling } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useBillingDetailsQuery } from "@src/queries/useBillingDetailsQueries";
import type { BillingDetails } from "@src/types/billingDetails";
import { BillingDetailsDialog } from "./BillingDetailsDialog";
import { describeTaxIdType, getCountryName } from "./billingDetailsOptions";

export const DEPENDENCIES = { useBillingDetailsQuery, useFlag, useActiveOrganization, BillingDetailsDialog };

type TaxIdVerificationStatus = NonNullable<NonNullable<BillingDetails["taxId"]>["verificationStatus"]>;

const VERIFICATION_BADGES: Record<TaxIdVerificationStatus, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  verified: { label: "Verified", variant: "success" },
  pending: { label: "Verification pending", variant: "secondary" },
  unverified: { label: "Not verified", variant: "destructive" },
  unavailable: { label: "Can't be verified right now", variant: "secondary" }
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const BillingDetailsView: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const isInvoicesEnabled = d.useFlag("invoices");

  return isInvoicesEnabled ? <BillingDetailsCard dependencies={d} /> : null;
};

const BillingDetailsCard: FC<Required<Props>> = ({ dependencies: d }) => {
  const { data: billingDetails, isLoading, isError } = d.useBillingDetailsQuery();
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { activeOrganization } = d.useActiveOrganization();
  const organization = isOrganizationsEnabled ? activeOrganization : undefined;
  const canEdit = !organization || canManageBilling(organization.role);
  const [isEditing, setIsEditing] = useState(false);
  const hasDetails = !!(billingDetails?.legalName || billingDetails?.address || billingDetails?.taxId);

  return (
    <SettingsSection title="Billing details">
      <Card className="overflow-hidden rounded-xl shadow-none">
        <div className="p-5 sm:px-6">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">Couldn't load your billing details. Refresh the page to try again.</p>
          ) : billingDetails && hasDetails ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted-foreground">Legal name</dt>
              <dd>{billingDetails.legalName || "Not set"}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="whitespace-pre-line">{formatAddress(billingDetails.address) || "Not set"}</dd>
              <dt className="text-muted-foreground">Tax ID</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {billingDetails.taxId ? (
                  <>
                    <span>
                      {describeTaxIdType(billingDetails.taxId.type)} {billingDetails.taxId.value}
                    </span>
                    {billingDetails.taxId.verificationStatus && (
                      <Badge variant={VERIFICATION_BADGES[billingDetails.taxId.verificationStatus].variant}>
                        {VERIFICATION_BADGES[billingDetails.taxId.verificationStatus].label}
                      </Badge>
                    )}
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </dl>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <FileText className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">No billing details yet</p>
              <p className="text-xs text-muted-foreground">Add a legal name, address and tax ID to have them printed on your invoices.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted px-5 py-3 text-[13px] text-muted-foreground sm:pl-6 sm:pr-4">
          <span>{canEdit ? "Printed on your invoices." : "Only owners and billing members can change these details."}</span>
          {canEdit && (
            <Button onClick={() => setIsEditing(true)} size="sm" variant="outline" disabled={isLoading || isError} className="ml-auto gap-1.5 bg-background">
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit details</span>
            </Button>
          )}
        </div>
      </Card>
      {isEditing && <d.BillingDetailsDialog billingDetails={billingDetails} onClose={() => setIsEditing(false)} />}
    </SettingsSection>
  );
};

function formatAddress(address: BillingDetails["address"]): string {
  if (!address) return "";

  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  const countryName = address.country ? getCountryName(address.country) : null;

  return [address.line1, address.line2, cityLine, address.state, countryName].filter(Boolean).join("\n");
}
