import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import { DEPENDENCIES, TeamPaymentMethodBanner } from "./TeamPaymentMethodBanner";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(TeamPaymentMethodBanner.name, () => {
  it.each(["owner", "billing"] satisfies OrganizationRole[])("asks a %s to set up the team's billing", role => {
    setup({ role });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Acme Corp has no payment method. Add one so your team can deploy. Organization billing is separate from your personal account."
    );
    expect(screen.getByRole("button", { name: "Set up billing" })).toBeInTheDocument();
  });

  it("opens the add card flow from Set up billing", () => {
    const { openAddPaymentMethod } = setup({ role: "owner" });

    fireEvent.click(screen.getByRole("button", { name: "Set up billing" }));

    expect(openAddPaymentMethod).toHaveBeenCalledOnce();
  });

  it.each(["admin", "member", "viewer"] satisfies OrganizationRole[])("tells a %s that nobody can deploy yet, without offering to set up billing", role => {
    setup({ role });

    expect(screen.getByRole("status")).toHaveTextContent("Acme Corp has no payment method. No one can deploy until an owner or a billing member adds one.");
    expect(screen.queryByRole("button", { name: "Set up billing" })).not.toBeInTheDocument();
  });

  it("renders nothing while no team is missing a payment method", () => {
    setup({});

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  function setup(input: { role?: OrganizationRole }) {
    const team = input.role ? mock<OrganizationOutput>({ name: "Acme Corp", type: "team", role: input.role, hasPaymentMethod: false }) : undefined;
    const openAddPaymentMethod = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useTeamWithoutPaymentMethod: () => team,
      useBillingActions: () => ({ openAddPaymentMethod })
    });

    render(<TeamPaymentMethodBanner dependencies={dependencies} />);

    return { openAddPaymentMethod };
  }
});
