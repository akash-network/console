import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingDetails } from "@src/types/billingDetails";
import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import type { DEPENDENCIES } from "./BillingDetailsView";
import { BillingDetailsView } from "./BillingDetailsView";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("BillingDetailsView", () => {
  it("shows the legal name, the address on separate lines and the verified tax ID", () => {
    setup({ billingDetails: SAVED });

    expect(screen.getByText("Acme GmbH")).toBeInTheDocument();
    expect(screen.getByText("Address").nextElementSibling?.textContent).toBe("Hauptstr. 1\nHinterhaus\n10115 Berlin\nBE\nGermany");
    expect(screen.getByText("EU VAT number DE123456789")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it.each([
    { status: "pending" as const, label: "Verification pending" },
    { status: "unverified" as const, label: "Not verified" },
    { status: "unavailable" as const, label: "Can't be verified right now" }
  ])("labels a $status tax ID as $label", ({ status, label }) => {
    setup({ billingDetails: { ...SAVED, taxId: { ...SAVED.taxId!, verificationStatus: status } } });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows a tax ID type it has no label for as its code, without a verification badge", () => {
    setup({ billingDetails: { ...SAVED, taxId: { type: "fr_siret", value: "12345678901234", verificationStatus: null } } });

    expect(screen.getByText("FR_SIRET 12345678901234")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("marks the parts that are not set yet", () => {
    setup({ billingDetails: { legalName: "alice", address: null, taxId: null } });

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("skips the address parts that are missing", () => {
    setup({ billingDetails: { ...SAVED, address: { line1: "1 Main St", line2: null, city: null, state: null, postalCode: null, country: null } } });

    expect(screen.getByText("Address").nextElementSibling?.textContent).toBe("1 Main St");
  });

  it("invites the user to add details when there are none", () => {
    setup({ billingDetails: { legalName: null, address: null, taxId: null } });

    expect(screen.getByText("No billing details yet")).toBeInTheDocument();
    expect(screen.queryByText("Legal name")).not.toBeInTheDocument();
  });

  it("does not show details or the empty state while loading", () => {
    setup({ billingDetails: undefined, isLoading: true });

    expect(screen.queryByText("No billing details yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Legal name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled();
  });

  it("explains when the details could not be loaded", () => {
    setup({ billingDetails: undefined, isError: true });

    expect(screen.getByText("Couldn't load your billing details. Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled();
  });

  it("opens the edit dialog with the saved details and closes it again", async () => {
    const { user, BillingDetailsDialog } = setup({ billingDetails: SAVED });

    expect(BillingDetailsDialog).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Edit details" }));

    expect(screen.getByText("Billing details dialog")).toBeInTheDocument();
    expect(BillingDetailsDialog.mock.lastCall![0]).toMatchObject({ billingDetails: SAVED });
    act(() => BillingDetailsDialog.mock.lastCall![0].onClose());

    expect(screen.queryByText("Billing details dialog")).not.toBeInTheDocument();
  });

  it.each(["owner", "billing"] as const)("lets a team %s edit the details", role => {
    setup({ billingDetails: SAVED, role });

    expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
    expect(screen.getByText("Printed on your invoices.")).toBeInTheDocument();
  });

  it("shows a team admin the details without letting them edit", () => {
    setup({ billingDetails: SAVED, role: "admin" });

    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.getByText("Only owners and billing members can change these details.")).toBeInTheDocument();
  });

  it("lets anyone edit while organizations are off for them", () => {
    setup({ billingDetails: SAVED, role: "admin", isOrganizationsEnabled: false });

    expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
  });

  it("lets anyone edit when no organization is active", () => {
    setup({ billingDetails: SAVED, role: null });

    expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
  });

  it("renders nothing and loads nothing while invoices are off", () => {
    const { useBillingDetailsQuery } = setup({ billingDetails: SAVED, isInvoicesEnabled: false });

    expect(screen.queryByText("Billing details")).not.toBeInTheDocument();
    expect(useBillingDetailsQuery).not.toHaveBeenCalled();
  });

  function setup(input: {
    billingDetails: BillingDetails | undefined;
    isLoading?: boolean;
    isError?: boolean;
    role?: OrganizationRole | null;
    isOrganizationsEnabled?: boolean;
    isInvoicesEnabled?: boolean;
  }) {
    const activeOrganization: OrganizationOutput | undefined =
      input.role === null
        ? undefined
        : { id: "org-2", name: "Acme", slug: "acme", type: "team", role: input.role ?? "owner", isActive: true, createdAt: "2026-01-01T00:00:00Z" };
    const BillingDetailsDialog = vi.fn<typeof DEPENDENCIES.BillingDetailsDialog>(() => <div>Billing details dialog</div>);
    const useBillingDetailsQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useBillingDetailsQuery>>(), {
        data: input.billingDetails,
        isLoading: input.isLoading ?? false,
        isError: input.isError ?? false
      })
    );

    const dependencies: typeof DEPENDENCIES = {
      useBillingDetailsQuery,
      useFlag: flag => (flag === "invoices" ? input.isInvoicesEnabled ?? true : input.isOrganizationsEnabled ?? true),
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization }),
      BillingDetailsDialog
    };

    render(<BillingDetailsView dependencies={dependencies} />);

    return { user: userEvent.setup(), BillingDetailsDialog, useBillingDetailsQuery };
  }
});

const SAVED: BillingDetails = {
  legalName: "Acme GmbH",
  address: { line1: "Hauptstr. 1", line2: "Hinterhaus", city: "Berlin", state: "BE", postalCode: "10115", country: "DE" },
  taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "verified" }
};
