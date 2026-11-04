import { describe, expect, it } from "vitest";

import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { GpuRequestCard } from "./GpuRequestCard";

import { render, screen, within } from "@testing-library/react";
import { buildHardwareRequest, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

describe(GpuRequestCard.name, () => {
  it("shows the request's GPUs, answers, progress and what happens next", () => {
    setup({
      status: "sourcing",
      createdAt: "2026-11-02T12:00:00.000Z",
      spec: buildHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" }, term: "6_months" })
    });

    const card = screen.getByRole("article", { name: "16× H200 · 2 servers" });
    expect(card).toHaveTextContent("Sent Nov 2, 2026");
    expect(card).toHaveTextContent("Anywhere · 1 TB NVMe · 6 months · Open to offers");
    expect(card).toHaveTextContent("We're talking to providers who can supply this hardware.");
    expect(
      within(card)
        .getAllByRole("listitem")
        .map(stage => stage.textContent)
    ).toEqual(["Submitted (done)", "In review (done)", "Sourcing (current step)", "Offers (not started)", "Accepted (not started)"]);
    expect(within(card).getByRole("listitem", { current: "step" })).toHaveTextContent("Sourcing");
    expect(screen.queryByText("Withdrawn")).not.toBeInTheDocument();
  });

  it("shows a withdrawn request as an end state without a tracker", () => {
    setup({ status: "withdrawn" });

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Request progress" })).not.toBeInTheDocument();
    expect(screen.getByText("You withdrew this request.")).toBeInTheDocument();
  });

  it("shows a request from the old form by its details", () => {
    setup({ spec: null, gpuModel: "RTX 5090", quantity: 1, details: "For a week" });

    expect(screen.getByRole("article", { name: "1× RTX 5090" })).toHaveTextContent("For a week");
  });

  it("leaves out the summary when the old form had no details", () => {
    setup({ spec: null, details: null, status: "closed" });

    expect(screen.getByRole("article", { name: "Hardware request" }).querySelectorAll("p")).toHaveLength(2);
  });

  function setup(input: Partial<HardwareRequest>) {
    return render(<GpuRequestCard request={buildHardwareRequest(input)} />);
  }
});
