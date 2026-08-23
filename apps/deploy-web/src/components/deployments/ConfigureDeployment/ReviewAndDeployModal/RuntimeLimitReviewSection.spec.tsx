import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./RuntimeLimitReviewSection";
import { MAX_RUNTIME_LIMIT_HOURS, RuntimeLimitReviewSection } from "./RuntimeLimitReviewSection";
import type { ReviewRow } from "./useReviewRows";

import { fireEvent, render, screen } from "@testing-library/react";

describe(RuntimeLimitReviewSection.name, () => {
  it("keeps the hours input hidden until the limit is switched on", () => {
    setup({});
    expect(screen.queryByLabelText("Runtime limit in hours")).not.toBeInTheDocument();
  });

  it("shows an existing limit with its input revealed", () => {
    setup({ value: 12 });
    expect(screen.getByLabelText("Runtime limit in hours")).toHaveValue(12);
  });

  it("proposes a default limit when switched on", async () => {
    const { onChange } = setup({});
    fireEvent.click(screen.getByRole("switch", { name: "Runtime limit" }));
    expect(onChange).toHaveBeenCalledWith(24);
  });

  it("clears the limit when switched off", () => {
    const { onChange } = setup({ value: 12 });
    fireEvent.click(screen.getByRole("switch", { name: "Runtime limit" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("reports whole hours through onChange", () => {
    const { onChange } = setup({ value: 12 });
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("floors a fractional input to whole hours", () => {
    const { onChange } = setup({ value: 12 });
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "2.7" } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("reports an emptied input as no limit", () => {
    const { onChange } = setup({ value: 12 });
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("caps the input at the maximum increment", () => {
    const { onChange } = setup({ value: 12 });
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "99999" } });
    expect(onChange).toHaveBeenCalledWith(MAX_RUNTIME_LIMIT_HOURS);
  });

  it("quotes the requested hours off the API's blocks per hour", () => {
    setup({ value: 2, rows: [pricedRow("100"), pricedRow("50")] });
    expect(screen.getByText("About $0.18 for 2h")).toBeInTheDocument();
  });

  it("omits the quote when no placement is priced", () => {
    setup({ value: 2, rows: [{ placementId: "p1", placementName: "placement-1", providerName: "Dune Networks", price: undefined }] });
    expect(screen.queryByText(/^About \$/)).not.toBeInTheDocument();
  });

  function pricedRow(amount: string): ReviewRow {
    return { placementId: `p-${amount}`, placementName: `placement-${amount}`, providerName: "Dune Networks", price: { amount, denom: "uakt" } };
  }

  function setup(input: { value?: number; rows?: ReviewRow[] }) {
    const onChange = vi.fn();
    const usePricing: typeof DEPENDENCIES.usePricing = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd: (amount: string | number) => Number(amount) / 1_000_000 });

    render(
      <TooltipProvider>
        <RuntimeLimitReviewSection value={input.value} onChange={onChange} rows={input.rows ?? [pricedRow("100")]} dependencies={{ usePricing }} />
      </TooltipProvider>
    );

    return { onChange };
  }
});
