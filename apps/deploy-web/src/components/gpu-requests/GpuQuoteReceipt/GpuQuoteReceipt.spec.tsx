import { describe, expect, it, vi } from "vitest";

import type { ReceiptSection } from "../gpuQuoteDraft/gpuQuoteReceipt";
import { GpuQuoteReceipt } from "./GpuQuoteReceipt";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const SECTIONS: ReceiptSection[] = [
  {
    step: "start",
    rows: [
      { label: "Setup", value: "Inference fleet" },
      { label: "GPUs", value: "2 nodes × 8 NVIDIA B300", detail: "16 GPUs total" }
    ]
  },
  { step: "region", rows: [{ label: "Region", value: null }] },
  { step: "sla", rows: [{ label: "SLA", value: null }] }
];

describe(GpuQuoteReceipt.name, () => {
  it("lists each section's answers under the request date", () => {
    setup();

    expect(screen.getByText("Nov 9, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Setup Inference fleet GPUs 2 nodes × 8 NVIDIA B300 16 GPUs total/ })).toBeInTheDocument();
  });

  it("goes back to a section's question when it is clicked", async () => {
    const { onChangeStep } = setup();

    await userEvent.click(screen.getByRole("button", { name: /Region/ }));

    expect(onChangeStep).toHaveBeenCalledWith("region");
  });

  it("dashes unanswered rows", () => {
    setup();

    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByText("—")[0]).toHaveClass("text-muted-foreground");
  });

  function setup() {
    const onChangeStep = vi.fn();
    render(<GpuQuoteReceipt sections={SECTIONS} date="Nov 9, 2026" onChangeStep={onChangeStep} />);
    return { onChangeStep };
  }
});
