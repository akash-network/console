import { describe, expect, it } from "vitest";

import type { GpuRequestOffer } from "../gpuOfferComparison/gpuOfferComparison";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { GpuOffersTable } from "./GpuOffersTable";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGpuRequestOffer, buildGpuRequestOfferTerms, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

const NOW = new Date(2026, 10, 4, 12, 0);

describe(GpuOffersTable.name, () => {
  it("compares each offer with the request, flagging what differs", () => {
    const spec = buildHardwareRequestSpec({ gpu: { model: "H100", count: 8, interconnect: "none" }, term: "6_months", targetPrice: { maxUsdPerGpuHour: 3 } });
    const offer = buildGpuRequestOffer({
      usdPerGpuHour: 2.5,
      estimatedMonthlyUsd: 14600,
      expiresAt: new Date(2026, 10, 7, 13, 0).toISOString(),
      terms: buildGpuRequestOfferTerms({ gpu: { model: "H100", count: 8, interconnect: "none" }, term: "month_to_month", location: "Oslo, NO" })
    });
    setup({ spec, offers: [offer] });

    const table = screen.getByRole("table", { name: "Offers compared with your request" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map(header => header.textContent)
    ).toEqual([
      "Offer",
      "Price per GPU-hour",
      "GPUs",
      "Location",
      "Available",
      "Term",
      "Uptime SLA",
      "Interconnect",
      "Storage per server",
      "Internet",
      "Provider"
    ]);
    const [, requestRow, offerRow] = within(table).getAllByRole("row");
    expect(within(requestRow).getByRole("rowheader")).toHaveTextContent("Your request");
    expect(requestRow).toHaveTextContent("Up to $3.00 per GPU-hour");
    expect(within(offerRow).getByRole("rowheader")).toHaveTextContent("Offer 1Expires in 3 days");
    expect(within(offerRow).getByText("≈ $14,600 a month")).toBeInTheDocument();
    expect(within(offerRow).getByText("Oslo, NO")).toBeInTheDocument();
    expect(within(offerRow).getByText("You asked for 6 months")).toBeInTheDocument();
    expect(within(offerRow).getByText("Month to month")).toBeInTheDocument();
    expect(screen.getByText("Doesn't match your request")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Sort offers" })).not.toBeInTheDocument();
  });

  it("shows no flag legend when every offer matches", () => {
    setup({ spec: buildHardwareRequestSpec(), offers: [buildGpuRequestOffer()] });

    expect(screen.queryByText("Doesn't match your request")).not.toBeInTheDocument();
  });

  it("shows the flag legend when any offer differs", () => {
    const spec = buildHardwareRequestSpec({ term: "6_months" });
    const matching = buildGpuRequestOffer({ terms: buildGpuRequestOfferTerms({ term: "6_months" }) });
    const differing = buildGpuRequestOffer({ terms: buildGpuRequestOfferTerms({ term: "3_months" }) });
    setup({ spec, offers: [matching, differing] });

    expect(screen.getByText("Doesn't match your request")).toBeInTheDocument();
  });

  it("sorts several offers, keeping the number each was published with", async () => {
    const pricey = buildGpuRequestOffer({ usdPerGpuHour: 3, expiresAt: new Date(2026, 10, 6).toISOString() });
    const cheap = buildGpuRequestOffer({ usdPerGpuHour: 1, expiresAt: new Date(2026, 10, 9).toISOString() });
    setup({ spec: buildHardwareRequestSpec(), offers: [pricey, cheap] });

    expect(offerLabels()).toEqual(["Offer 2", "Offer 1"]);
    expect(screen.getByRole("button", { name: "Lowest price" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Expiring soonest" }));

    expect(offerLabels()).toEqual(["Offer 1", "Offer 2"]);
    expect(screen.getByRole("button", { name: "Expiring soonest" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Lowest price" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows only the accepted offer, still numbered among the others", () => {
    const closed = buildGpuRequestOffer({ status: "closed" });
    const accepted = buildGpuRequestOffer({ status: "accepted" });
    setup({ spec: buildHardwareRequestSpec(), offers: [closed, accepted] });

    expect(offerLabels()).toEqual(["Offer 2"]);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("adds each offer's actions in a last column", () => {
    const offer = buildGpuRequestOffer();
    render(
      <GpuOffersTable
        spec={buildHardwareRequestSpec()}
        offers={[offer]}
        now={NOW}
        renderActions={(_, label) => <button type="button">Act on {label}</button>}
      />
    );

    expect(screen.getAllByRole("columnheader").at(-1)).toHaveTextContent("Actions");
    const [, requestRow, offerRow] = screen.getAllByRole("row");
    expect(within(offerRow).getAllByRole("cell").at(-1)).toContainElement(screen.getByRole("button", { name: "Act on Offer 1" }));
    expect(within(requestRow).getAllByRole("cell").at(-1)).toBeEmptyDOMElement();
  });

  it("has no actions column without actions", () => {
    setup({ spec: buildHardwareRequestSpec(), offers: [buildGpuRequestOffer()] });

    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
  });

  function offerLabels() {
    return screen
      .getAllByRole("rowheader")
      .slice(1)
      .map(header => header.firstChild?.textContent);
  }

  function setup(input: { spec: HardwareRequest["spec"]; offers: GpuRequestOffer[] }) {
    render(<GpuOffersTable spec={input.spec} offers={input.offers} now={NOW} />);
  }
});
