import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { format, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { MarketplaceProvidersTable } from "./MarketplaceProvidersTable";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(MarketplaceProvidersTable.name, () => {
  it("renders a row per provider showing host and region", () => {
    setup({
      providers: [
        buildOffer({ hostUri: "https://a.example:8443", location: "us-west" }),
        buildOffer({ hostUri: "https://b.example:8443", location: "eu-central" })
      ]
    });

    expect(screen.getByText("a.example")).toBeInTheDocument();
    expect(screen.getByText("us-west")).toBeInTheDocument();
    expect(screen.getByText("b.example")).toBeInTheDocument();
    expect(screen.getByText("eu-central")).toBeInTheDocument();
  });

  it("renders an em dash when region is null", () => {
    setup({ providers: [buildOffer({ hostUri: "https://a.example:8443", location: null })] });

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("sorts rows by provider host when the Provider header is toggled ascending", async () => {
    setup({
      providers: [buildOffer({ hostUri: "https://zeta.example:8443" }), buildOffer({ hostUri: "https://alpha.example:8443" })]
    });

    await userEvent.click(screen.getByRole("button", { name: /Provider/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alpha.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("zeta.example")).toBeInTheDocument();
  });

  it("sorts by the displayed hostname regardless of scheme or port", async () => {
    setup({
      providers: [buildOffer({ hostUri: "http://zeta.example:80" }), buildOffer({ hostUri: "https://alpha.example:8443" })]
    });

    await userEvent.click(screen.getByRole("button", { name: /Provider/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alpha.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("zeta.example")).toBeInTheDocument();
  });

  it("sorts rows by derived uptime when the Uptime header is toggled ascending", async () => {
    const recentDay = format(subDays(new Date(), 2), "yyyy-MM-dd");
    const downProvider = buildOffer({
      owner: "akash1down",
      hostUri: "https://down.example:8443",
      incidents: [{ date: recentDay, hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 24 * 60 * 60 }]
    });
    const upProvider = buildOffer({ owner: "akash1up", hostUri: "https://up.example:8443", incidents: [] });
    setup({ providers: [upProvider, downProvider] });

    await userEvent.click(screen.getByRole("button", { name: /Uptime/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("down.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("up.example")).toBeInTheDocument();
  });

  it("displays the organization name when present", () => {
    setup({ providers: [buildOffer({ organization: "Polaris Compute", hostUri: "https://a.example:8443" })] });

    expect(screen.getByText("Polaris Compute")).toBeInTheDocument();
  });

  it("falls back to the host name when organization is absent", () => {
    setup({ providers: [buildOffer({ organization: null, hostUri: "https://a.example:8443" })] });

    expect(screen.getByText("a.example")).toBeInTheDocument();
  });

  it("falls back to the provider address when it has no host or organization (bid-sourced offer)", () => {
    setup({ providers: [buildOffer({ organization: null, hostUri: "", owner: "akash1bidder" })] });

    expect(screen.getByText("akash1bidder")).toBeInTheDocument();
  });

  it("shows a search empty state with a clear action when a search excludes all rows", async () => {
    const onClearSearch = vi.fn();
    setup({ providers: [], isSearchActive: true, onClearSearch });

    expect(screen.getByText(/no providers match/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onClearSearch).toHaveBeenCalled();
  });

  it("shows the plain empty state when not searching and there are no providers", () => {
    setup({ providers: [], isSearchActive: false });

    expect(screen.getByText("No providers found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
  });

  it("omits the clear action in the search empty state when no clear handler is provided", () => {
    setup({ providers: [], isSearchActive: true });

    expect(screen.getByText(/no providers match/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
  });

  it("hides the Cost column until a bid is received", () => {
    setup({ providers: [searchingOffer({ owner: "akash1a" })] });
    expect(screen.queryByText("Cost")).not.toBeInTheDocument();
  });

  it("shows the Cost column once a bid is submitted", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })] });
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("drops the empty Select column when no offer is selectable, leaving only Provider, Region, and Uptime", () => {
    setup({ providers: [searchingOffer({ owner: "akash1a" })] });
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("enables Select only for submitted offers", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), searchingOffer({ owner: "akash1b" })] });
    expect(screen.getByRole("button", { name: "Select akash1a" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Select akash1b" })).not.toBeInTheDocument();
  });

  it("calls onSelect with the offer's bid id when Select is clicked", async () => {
    const { onSelect, user } = setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })] });
    await user.click(screen.getByRole("button", { name: "Select akash1a" }));
    expect(onSelect).toHaveBeenCalledWith("akash1a/1/1/1");
  });

  it("marks the selected offer's row and makes its button non-clickable", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], selectedBidId: "akash1a/1/1/1" });
    expect(screen.getByRole("button", { name: /selected/i })).toBeDisabled();
  });

  /** A screened provider promoted to a (not-yet-bid) offer, so the display/sort tests keep using the realistic seeder without casting. */
  function buildOffer(overrides?: Parameters<typeof buildScreenedProvider>[0]): PlacementOffer {
    return { ...buildScreenedProvider(overrides), offerState: "searching" };
  }

  function submittedOffer(overrides: Partial<PlacementOffer>): PlacementOffer {
    return mock<PlacementOffer>({
      offerState: "submitted",
      price: { amount: "100", denom: "uakt" },
      organization: null,
      hostUri: "",
      location: null,
      incidents: [],
      ...overrides
    });
  }

  function searchingOffer(overrides: Partial<PlacementOffer>): PlacementOffer {
    return mock<PlacementOffer>({
      offerState: "searching",
      bidId: undefined,
      price: undefined,
      organization: null,
      hostUri: "",
      location: null,
      incidents: [],
      ...overrides
    });
  }

  function setup(input: { providers: PlacementOffer[]; isLoading?: boolean; isSearchActive?: boolean; onClearSearch?: () => void; selectedBidId?: string }) {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <TestContainerProvider>
        <IntlProvider locale="en">
          <TooltipProvider>
            <MarketplaceProvidersTable
              providers={input.providers}
              isLoading={input.isLoading}
              isSearchActive={input.isSearchActive}
              onClearSearch={input.onClearSearch}
              selectedBidId={input.selectedBidId}
              onSelect={onSelect}
            />
          </TooltipProvider>
        </IntlProvider>
      </TestContainerProvider>
    );
    return { onSelect, user };
  }
});
