import React from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import { type DEPENDENCIES, TransactionInvoiceButton } from "./TransactionInvoiceButton";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTransaction } from "@tests/seeders/payment";

type InvoiceMutation = ReturnType<typeof DEPENDENCIES.useTransactionInvoiceMutation>;

describe(TransactionInvoiceButton.name, () => {
  it("offers to download the invoice a card payment already has", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", stripeInvoiceId: "in_1" }) });

    expect(screen.getByRole("button", { name: "Download invoice" })).toBeInTheDocument();
  });

  it("offers an invoice for a successful card payment that has none yet", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", status: "succeeded", stripeInvoiceId: null }) });

    expect(screen.getByRole("button", { name: "Get invoice" })).toBeInTheDocument();
  });

  it("renders nothing while invoices are turned off", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", stripeInvoiceId: "in_1" }), isInvoicesEnabled: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["coupon_claim", "manual_credit"] as const)("renders nothing for a %s, which has no card payment to invoice", type => {
    setup({ transaction: createMockTransaction({ type, status: "succeeded", stripeInvoiceId: "in_1" }) });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["failed", "pending", "refunded"])("offers no new invoice for a %s card payment", status => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", status, stripeInvoiceId: null }) });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["owner", "billing"] as const)("lets a team %s get a new invoice", role => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", status: "succeeded", stripeInvoiceId: null }), role });

    expect(screen.getByRole("button", { name: "Get invoice" })).toBeInTheDocument();
  });

  it("lets an admin download an existing invoice but not get a new one", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", status: "succeeded", stripeInvoiceId: "in_1" }), role: "admin" });

    expect(screen.getByRole("button", { name: "Download invoice" })).toBeInTheDocument();
  });

  it("offers an admin no new invoice", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", status: "succeeded", stripeInvoiceId: null }), role: "admin" });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ignores the team role while organizations are turned off", () => {
    setup({
      transaction: createMockTransaction({ type: "payment_intent", status: "succeeded", stripeInvoiceId: null }),
      role: "admin",
      isOrganizationsEnabled: false
    });

    expect(screen.getByRole("button", { name: "Get invoice" })).toBeInTheDocument();
  });

  it("saves the invoice PDF in place, named after the payment date, without opening a tab", async () => {
    const created = new Date(2026, 9, 14, 12);
    const { transaction, mutateAsync, savedFiles, open, resolveInvoice } = setup({
      transaction: createMockTransaction({ type: "payment_intent", stripeInvoiceId: "in_1", created: created.getTime() / 1000 })
    });
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });

    await userEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    expect(mutateAsync).toHaveBeenCalledWith(transaction.id);
    expect(savedFiles).toEqual([]);

    resolveInvoice(pdf);

    await waitFor(() => expect(savedFiles).toEqual([{ href: "blob:invoice", download: "akash-invoice-2026-10-14.pdf" }]));
    expect(URL.createObjectURL).toHaveBeenCalledWith(pdf);
    expect(open).not.toHaveBeenCalled();
  });

  it("explains when the invoice can't be fetched and saves nothing", async () => {
    const { enqueueSnackbar, savedFiles, rejectInvoice } = setup({ transaction: createMockTransaction({ type: "payment_intent", stripeInvoiceId: "in_1" }) });

    await userEvent.click(screen.getByRole("button", { name: "Download invoice" }));
    rejectInvoice(new Error("Stripe is down"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" }));
    expect(savedFiles).toEqual([]);
  });

  it("shows a spinner and blocks a second click while the invoice is on its way", () => {
    setup({ transaction: createMockTransaction({ type: "payment_intent", stripeInvoiceId: "in_1" }), isPending: true });

    expect(screen.getByRole("button", { name: "Preparing invoice…" })).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  function setup(input: {
    transaction: ReturnType<typeof createMockTransaction>;
    role?: OrganizationRole;
    isInvoicesEnabled?: boolean;
    isOrganizationsEnabled?: boolean;
    isPending?: boolean;
  }) {
    const activeOrganization: OrganizationOutput | undefined = input.role
      ? { id: "org-1", name: "Acme", slug: "acme", type: "team", role: input.role, isActive: true, createdAt: "2026-01-01T00:00:00Z" }
      : undefined;
    const invoiceResponse = Promise.withResolvers<Awaited<ReturnType<InvoiceMutation["mutateAsync"]>>>();
    const mutateAsync = vi.fn<InvoiceMutation["mutateAsync"]>(() => invoiceResponse.promise);
    const open = vi.spyOn(window, "open");
    const savedFiles = spyOnFileDownloads();
    onTestFinished(() => open.mockRestore());
    const enqueueSnackbar = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      useTransactionInvoiceMutation: () => mock<InvoiceMutation>({ mutateAsync, isPending: input.isPending ?? false }),
      useFlag: flag => ({ invoices: input.isInvoicesEnabled ?? true, organizations: input.isOrganizationsEnabled ?? true })[flag as string] ?? false,
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(<TransactionInvoiceButton transaction={input.transaction} dependencies={dependencies} />);

    return {
      transaction: input.transaction,
      mutateAsync,
      open,
      savedFiles,
      enqueueSnackbar,
      resolveInvoice: invoiceResponse.resolve,
      rejectInvoice: invoiceResponse.reject
    };
  }

  function spyOnFileDownloads() {
    const savedFiles: { href: string | null; download: string | null }[] = [];
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = vi.fn(() => "blob:invoice");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      savedFiles.push({ href: this.getAttribute("href"), download: this.getAttribute("download") });
    });
    onTestFinished(() => {
      click.mockRestore();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    });

    return savedFiles;
  }
});
