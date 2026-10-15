"use client";
import type { FC } from "react";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { FileDown } from "lucide-react";
import { useSnackbar } from "notistack";

import { canManageBilling } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { BillingTransaction } from "@src/queries";
import { useTransactionInvoiceMutation } from "@src/queries/useTransactionInvoiceQueries";
import { openPendingTab } from "@src/utils/openPendingTab";

export const DEPENDENCIES = { useTransactionInvoiceMutation, useFlag, useActiveOrganization, useSnackbar };

type Props = {
  transaction: BillingTransaction;
  dependencies?: typeof DEPENDENCIES;
};

export const TransactionInvoiceButton: FC<Props> = ({ transaction, dependencies: d = DEPENDENCIES }) => {
  const isInvoicesEnabled = d.useFlag("invoices");
  const isOrganizationsEnabled = d.useFlag("organizations");
  const { activeOrganization } = d.useActiveOrganization();
  const organization = isOrganizationsEnabled ? activeOrganization : undefined;
  const canIssueInvoice = !organization || canManageBilling(organization.role);
  const isCardPayment = transaction.type === "payment_intent";
  const hasInvoice = !!transaction.stripeInvoiceId;
  const canGetNewInvoice = transaction.status === "succeeded" && canIssueInvoice;

  if (!isInvoicesEnabled || !isCardPayment || !(hasInvoice || canGetNewInvoice)) {
    return null;
  }

  return <InvoiceButton transactionId={transaction.id} label={hasInvoice ? "Download invoice" : "Get invoice"} dependencies={d} />;
};

const InvoiceButton: FC<{ transactionId: string; label: string; dependencies: typeof DEPENDENCIES }> = ({ transactionId, label, dependencies: d }) => {
  const { mutateAsync, isPending } = d.useTransactionInvoiceMutation();
  const { enqueueSnackbar } = d.useSnackbar();

  const openInvoice = async () => {
    const tab = openPendingTab();
    const invoicePdfUrl = await mutateAsync({ id: transactionId }).then(
      ({ data }) => data.invoicePdfUrl,
      () => null
    );

    if (invoicePdfUrl) {
      tab.navigate(invoicePdfUrl);
    } else {
      tab.close();
      enqueueSnackbar(<Snackbar title="Couldn't get the invoice" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={isPending}
      onClick={openInvoice}
      className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:pointer-events-none"
    >
      {isPending ? <Spinner size="small" /> : <FileDown className="h-[17px] w-[17px]" />}
    </button>
  );
};
