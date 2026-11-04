import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { GpuRequestCard } from "./GpuRequestCard";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildHardwareRequest, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

describe(GpuRequestCard.name, () => {
  it("shows the request's GPUs, answers, progress and what happens next", () => {
    setup({
      status: "sourcing",
      createdAt: "2026-11-02T12:00:00.000Z",
      spec: buildHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" }, term: "6_months" })
    });

    const card = screen.getByRole("article", { name: "16× H200 · 2 servers" });
    expect(card).toHaveTextContent(
      `Sent ${new Date("2026-11-02T12:00:00.000Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    );
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

  it("shows the notes of a quote request under its answers", () => {
    setup({ spec: buildHardwareRequestSpec(), details: "Need it for a demo on Friday" });

    expect(screen.getByText("Need it for a demo on Friday")).toBeInTheDocument();
  });

  it("shows no notes line for a quote request without notes", () => {
    setup({ spec: buildHardwareRequestSpec({ gpu: { model: "A100", count: 1, interconnect: "none" } }), details: null });

    expect(screen.getByRole("article").querySelectorAll("p")).toHaveLength(3);
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

  it("shows the offers under the status message", () => {
    setup({ status: "offers" }, { offers: <div>Offers table</div> });

    expect(screen.getByRole("article")).toHaveTextContent("We have offers for you and will email you to go over them.Offers table");
  });

  it("offers to withdraw the request when the viewer may", async () => {
    const onWithdraw = vi.fn();
    setup({}, { onWithdraw });

    await userEvent.click(screen.getByRole("button", { name: "Withdraw request" }));

    expect(onWithdraw).toHaveBeenCalledOnce();
  });

  it("offers no withdrawal otherwise", () => {
    setup({});

    expect(screen.queryByRole("button", { name: "Withdraw request" })).not.toBeInTheDocument();
  });

  it("scrolls to and marks the request a link pointed at", () => {
    const { scrollIntoView } = setup({}, { isFocused: true });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(screen.getByRole("article")).toHaveAttribute("aria-current", "true");
  });

  it("leaves other requests where they are", () => {
    const { scrollIntoView } = setup({});

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("article")).not.toHaveAttribute("aria-current");
  });

  function setup(input: Partial<HardwareRequest>, props: { isFocused?: boolean; offers?: ReactNode; onWithdraw?: () => void } = {}) {
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockClear();
    render(<GpuRequestCard request={buildHardwareRequest(input)} {...props} />);

    return { scrollIntoView };
  }
});
