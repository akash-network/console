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
    ).toEqual(["Compared on", "Your request", "Offer 1Expires in 3 days"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map(header => header.textContent)
    ).toEqual(["Price per GPU-hour", "GPUs", "Location", "Available", "Term", "Uptime SLA", "Interconnect", "Storage per server", "Internet", "Provider"]);
    expect(cellsOf("Price per GPU-hour")).toEqual(["Up to $3.00 per GPU-hour", "$2.50≈ $14,600 a month"]);
    expect(cellsOf("Location")[1]).toBe("Oslo, NO");
    expect(cellsOf("Term")).toEqual(["6 months", "Month to monthYou asked for 6 months"]);
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

  it("adds each offer's actions in a last row, under that offer", () => {
    const offer = buildGpuRequestOffer();
    render(
      <GpuOffersTable
        spec={buildHardwareRequestSpec()}
        offers={[offer]}
        now={NOW}
        renderActions={(_, label) => <button type="button">Act on {label}</button>}
      />
    );

    const actionsRow = screen.getAllByRole("row").at(-1)!;
    expect(within(actionsRow).getByRole("rowheader")).toHaveTextContent("Actions");
    const [requestCell, offerCell] = within(actionsRow).getAllByRole("cell");
    expect(offerCell).toContainElement(screen.getByRole("button", { name: "Act on Offer 1" }));
    expect(requestCell).toBeEmptyDOMElement();
  });

  it("has no actions row without actions", () => {
    setup({ spec: buildHardwareRequestSpec(), offers: [buildGpuRequestOffer()] });

    expect(screen.queryByRole("rowheader", { name: "Actions" })).not.toBeInTheDocument();
  });

  function offerLabels() {
    return screen
      .getAllByRole("columnheader")
      .slice(2)
      .map(header => header.firstChild?.textContent);
  }

  function cellsOf(attributeLabel: string) {
    const row = screen.getByRole("rowheader", { name: attributeLabel }).closest("tr")!;
    return within(row)
      .getAllByRole("cell")
      .map(cell => cell.textContent);
  }

  function setup(input: { spec: HardwareRequest["spec"]; offers: GpuRequestOffer[] }) {
    render(<GpuOffersTable spec={input.spec} offers={input.offers} now={NOW} />);
  }
});
