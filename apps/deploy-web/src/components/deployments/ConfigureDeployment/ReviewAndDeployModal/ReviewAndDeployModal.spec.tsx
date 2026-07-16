import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { DEPENDENCIES } from "./ReviewAndDeployModal";
import { ReviewAndDeployModal } from "./ReviewAndDeployModal";
import type { ReviewRow } from "./useReviewRows";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ReviewAndDeployModal.name, () => {
  it("lists one row per selected placement with provider and price", () => {
    setup({
      rows: [{ placementId: "p1", placementName: "placement-1", region: "Any region", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } }]
    });
    expect(screen.getByText("placement-1 · Any region")).toBeInTheDocument();
    expect(screen.getByText("Dune Networks")).toBeInTheDocument();
    expect(screen.getAllByTestId("price")).toHaveLength(2);
  });

  it("prices per placement and total by the hour when the deployment uses a GPU", () => {
    setup({ hasGpu: true });
    screen.getAllByTestId("price").forEach(price => expect(price).toHaveTextContent("hourly"));
  });

  it("prices per placement and total by the month for a CPU-only deployment", () => {
    setup({ hasGpu: false });
    screen.getAllByTestId("price").forEach(price => expect(price).toHaveTextContent("monthly"));
  });

  it("confirms with onConfirm", async () => {
    const onConfirm = vi.fn();
    setup({ onConfirm });
    await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("goes back with onBack", async () => {
    const onBack = vi.fn();
    setup({ onBack });
    await userEvent.click(screen.getByRole("button", { name: /back to marketplace/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("disables Confirm and deploy when a selected placement is no longer priced", () => {
    setup({
      rows: [
        { placementId: "p1", placementName: "placement-1", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } },
        { placementId: "p2", placementName: "placement-2", providerName: "Polaris", price: undefined }
      ],
      pricedCount: 1,
      totalCount: 2
    });
    expect(screen.getByRole("button", { name: /confirm and deploy/i })).toBeDisabled();
  });

  function setup(input: { rows?: ReviewRow[]; pricedCount?: number; totalCount?: number; hasGpu?: boolean; onConfirm?: () => void; onBack?: () => void }) {
    const rows = input.rows ?? [
      { placementId: "p1", placementName: "placement-1", region: "Any region", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } }
    ];
    const useReviewRows: typeof DEPENDENCIES.useReviewRows = () => ({
      rows,
      pricedCount: input.pricedCount ?? rows.filter(row => row.price).length,
      totalCount: input.totalCount ?? rows.length
    });
    const PricePerTimeUnit: typeof DEPENDENCIES.PricePerTimeUnit = ({ showAsHourly }) => <span data-testid="price">{showAsHourly ? "hourly" : "monthly"}</span>;
    const useDeploymentHasGpu: typeof DEPENDENCIES.useDeploymentHasGpu = () => input.hasGpu ?? false;
    render(
      <ReviewAndDeployModal
        open
        dseq="55"
        placements={[mock<PlacementType>({ id: "p1", name: "placement-1", region: "Any region" })]}
        selections={{ p1: "akash1a/55/1/2" }}
        onConfirm={input.onConfirm ?? vi.fn()}
        onBack={input.onBack ?? vi.fn()}
        dependencies={{ useReviewRows, PricePerTimeUnit, useDeploymentHasGpu }}
      />
    );
  }
});
