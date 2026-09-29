import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { format, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import type { GpuVendor } from "@src/types/gpu";
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

  it("displays the organization name with the actual host beneath it", () => {
    setup({ providers: [buildOffer({ organization: "Polaris Compute", hostUri: "https://provider.wdc.com:8443" })] });

    expect(screen.getByText("Polaris Compute")).toBeInTheDocument();
    expect(screen.getByText("provider.wdc.com")).toBeInTheDocument();
  });

  it("falls back to the host name when organization is absent and shows no duplicate host beneath it", () => {
    setup({ providers: [buildOffer({ organization: null, hostUri: "https://a.example:8443" })] });

    expect(screen.getByText("a.example")).toBeInTheDocument();
  });

  it("falls back to the provider address when it has no host or organization (bid-sourced offer)", () => {
    setup({ providers: [buildOffer({ organization: null, hostUri: "", owner: "akash1bidder" })] });

    expect(screen.getByText("akash1bidder")).toBeInTheDocument();
  });

  it("links the provider name to its detail page in a new tab", () => {
    setup({ providers: [buildOffer({ organization: "Polaris Compute", hostUri: "https://a.example:8443", owner: "akash1prov" })] });

    const link = screen.getByRole("link", { name: "Polaris Compute" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/providers/akash1prov"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders the provider name as plain text, not a link, when provider links are hidden", () => {
    setup({ providers: [buildOffer({ organization: "Polaris Compute", hostUri: "https://a.example:8443", owner: "akash1prov" })], showProviderLink: false });

    expect(screen.getByText("Polaris Compute")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Polaris Compute" })).not.toBeInTheDocument();
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

  it("shows a caller-supplied empty message in place of the plain one", () => {
    setup({ providers: [], isSearchActive: false, emptyMessage: "No arm64 providers matched this configuration." });

    expect(screen.getByText("No arm64 providers matched this configuration.")).toBeInTheDocument();
    expect(screen.queryByText("No providers found.")).not.toBeInTheDocument();
  });

  it("keeps the search empty state when a search is active, even with an empty message supplied", () => {
    setup({ providers: [], isSearchActive: true, emptyMessage: "No arm64 providers matched this configuration." });

    expect(screen.getByText("No providers match your search.")).toBeInTheDocument();
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

  it("shows the Cost column when the only bids have expired", () => {
    setup({ providers: [closedOffer({ owner: "akash1c", hostUri: "https://c.example:8443" })] });
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("shows both hourly and monthly cost for a GPU spec", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], gpuCount: 8 });
    expect(screen.getByText("/hr")).toBeInTheDocument();
    expect(screen.getByText("/month")).toBeInTheDocument();
  });

  it("shows only the monthly cost for a CPU-only spec so an inexpensive deployment doesn't read as $0.00/hr", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], gpuCount: 0 });
    expect(screen.getByText("/month")).toBeInTheDocument();
    expect(screen.queryByText("/hr")).not.toBeInTheDocument();
  });

  it("shows the gpu model each provider bid with by its catalog display name", () => {
    setup({
      providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", gpus: [{ vendor: "nvidia", model: "rtx4090" }] })],
      gpuVendors: [{ name: "nvidia", models: [{ name: "rtx4090", displayName: "RTX 4090", memory: [], interface: [] }] }]
    });
    expect(screen.getByRole("button", { name: /GPU/ })).toBeInTheDocument();
    expect(screen.getByText("RTX 4090")).toBeInTheDocument();
  });

  it("shows the upper-cased gpu model when the catalog has no display name for it", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", gpus: [{ vendor: "nvidia", model: "h100" }] })] });
    expect(screen.getByText("H100")).toBeInTheDocument();
  });

  it("hides the GPU column when no bid carries a gpu model", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", gpus: [] })] });
    expect(screen.queryByRole("button", { name: /GPU/ })).not.toBeInTheDocument();
  });

  it("sorts the bidding rows by gpu model when the GPU header is toggled ascending", async () => {
    setup({
      providers: [
        submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", hostUri: "https://rtx.example:8443", gpus: [{ vendor: "nvidia", model: "rtx4090" }] }),
        submittedOffer({ owner: "akash1b", bidId: "akash1b/1/1/1", hostUri: "https://a100.example:8443", gpus: [{ vendor: "nvidia", model: "a100" }] })
      ]
    });

    await userEvent.click(screen.getByRole("button", { name: /GPU/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("a100.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("rtx.example")).toBeInTheDocument();
  });

  it("shows only Provider, Region, and Uptime while every offer is still searching", () => {
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

  it("disables every Select button when selection is turned off", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], isSelectable: false });
    expect(screen.getByRole("button", { name: "Select akash1a" })).toBeDisabled();
  });

  it("marks the table busy while its candidates wait for bids", () => {
    setup({ providers: [searchingOffer({ owner: "akash1a" })], isBusy: true });

    expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });

  it("leaves the table idle by default", () => {
    setup({ providers: [searchingOffer({ owner: "akash1a" })] });

    expect(screen.getByRole("table").closest("[aria-busy]")).toBeNull();
  });

  it("marks the selected offer's row and makes its button non-clickable", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], selectedBidId: "akash1a/1/1/1" });
    expect(screen.getByRole("button", { name: /selected/i })).toBeDisabled();
  });

  it("leaves the selected mark to the Select button while rows don't select", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], selectedBidId: "akash1a/1/1/1" });

    expect(screen.queryByRole("img", { name: "Selected provider" })).not.toBeInTheDocument();
  });

  it("mutes the rows that can't be picked", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), closedOffer({ owner: "akash1c", bidId: "akash1c/1/1/1" })] });

    expect(screen.getByRole("row", { name: /akash1c/ })).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("row", { name: /akash1a/ })).not.toHaveClass("text-muted-foreground");
  });

  it("renders a non-bidding screened provider with a No bid indicator and no Select button", () => {
    setup({
      providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), unavailableOffer({ owner: "akash1b", hostUri: "https://b.example:8443" })]
    });
    expect(screen.getByText("No bid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select akash1b" })).not.toBeInTheDocument();
  });

  it("marks a provider whose bid expired with an Expired indicator", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), closedOffer({ owner: "akash1c", hostUri: "https://c.example:8443" })] });
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("pins non-bidding rows below the bidding rows", () => {
    setup({
      providers: [
        unavailableOffer({ owner: "akash1b", hostUri: "https://nobid.example:8443" }),
        submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", hostUri: "https://bidder.example:8443" })
      ]
    });
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("bidder.example")).toBeInTheDocument();
    expect(within(rows[rows.length - 1]).getByText("nobid.example")).toBeInTheDocument();
  });

  it("keeps an expired bid in the bidding group above the divider, not selectable", () => {
    setup({
      providers: [
        unavailableOffer({ owner: "akash1n", hostUri: "https://never.example:8443" }),
        submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", hostUri: "https://bidder.example:8443" }),
        closedOffer({ owner: "akash1c", hostUri: "https://closed.example:8443" })
      ]
    });
    const rowTexts = screen.getAllByRole("row").map(row => row.textContent ?? "");
    const closedIndex = rowTexts.findIndex(text => text.includes("closed.example"));
    const dividerIndex = rowTexts.findIndex(text => /didn't bid/i.test(text));
    const neverIndex = rowTexts.findIndex(text => text.includes("never.example"));
    expect(closedIndex).toBeGreaterThan(-1);
    expect(closedIndex).toBeLessThan(dividerIndex);
    expect(dividerIndex).toBeLessThan(neverIndex);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select closed.example" })).not.toBeInTheDocument();
  });

  it("sorts the bidding rows by cost when the Cost header is toggled ascending", async () => {
    setup({
      providers: [
        submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", hostUri: "https://pricey.example:8443", price: { amount: "5000", denom: "uakt" } }),
        submittedOffer({ owner: "akash1b", bidId: "akash1b/1/1/1", hostUri: "https://cheap.example:8443", price: { amount: "1000", denom: "uakt" } })
      ]
    });

    await userEvent.click(screen.getByRole("button", { name: /Cost/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("cheap.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("pricey.example")).toBeInTheDocument();
  });

  it("keeps bidding rows on top while sorting the non-bidding rows by the active column", async () => {
    setup({
      providers: [
        unavailableOffer({ owner: "akash1m", hostUri: "https://mmm.example:8443" }),
        submittedOffer({ owner: "akash1z", bidId: "akash1z/1/1/1", hostUri: "https://zzz.example:8443" }),
        unavailableOffer({ owner: "akash1a", hostUri: "https://aaa.example:8443" })
      ]
    });

    await userEvent.click(screen.getByRole("button", { name: /Provider/ }));

    const rowTexts = screen.getAllByRole("row").map(row => row.textContent ?? "");
    const biddingIndex = rowTexts.findIndex(text => text.includes("zzz.example"));
    const firstNoBidIndex = rowTexts.findIndex(text => text.includes("aaa.example"));
    const secondNoBidIndex = rowTexts.findIndex(text => text.includes("mmm.example"));
    expect(biddingIndex).toBeLessThan(firstNoBidIndex);
    expect(firstNoBidIndex).toBeLessThan(secondNoBidIndex);
  });

  it("shows the didn't-bid divider when both bidding and non-bidding rows are present", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), unavailableOffer({ owner: "akash1b" })] });
    expect(screen.getByText(/didn't bid/i)).toBeInTheDocument();
  });

  it("omits the didn't-bid divider when only bidding rows are present", () => {
    setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })] });
    expect(screen.queryByText(/didn't bid/i)).not.toBeInTheDocument();
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

  function closedOffer(overrides: Partial<PlacementOffer>): PlacementOffer {
    return mock<PlacementOffer>({
      offerState: "closed",
      bidId: undefined,
      price: { amount: "100", denom: "uakt" },
      organization: null,
      hostUri: "",
      location: null,
      incidents: [],
      ...overrides
    });
  }

  function unavailableOffer(overrides: Partial<PlacementOffer>): PlacementOffer {
    return mock<PlacementOffer>({
      offerState: "unavailable",
      bidId: undefined,
      price: undefined,
      organization: null,
      hostUri: "",
      location: null,
      incidents: [],
      ...overrides
    });
  }

  describe("when rows select their offer", () => {
    it("selects a submitted offer when its row is clicked", async () => {
      const { onSelect, user } = setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", location: "us-west" })],
        selectOnRowClick: true
      });

      await user.click(screen.getByText("us-west"));

      expect(onSelect).toHaveBeenCalledWith("akash1a/1/1/1");
    });

    it("keeps a select button for keyboard and assistive technology that is visually hidden", async () => {
      const { onSelect, user } = setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], selectOnRowClick: true });
      const button = screen.getByRole("button", { name: "Select akash1a" });

      await user.click(button);

      expect(button.parentElement).toHaveClass("sr-only");
      expect(button).not.toHaveClass("sr-only");
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("leaves the provider link to open the provider instead of selecting", async () => {
      const { onSelect, user } = setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", hostUri: "https://a.example:8443" })],
        selectOnRowClick: true
      });

      await user.click(screen.getByRole("link", { name: "a.example" }));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("ignores clicks on elements that opt out of selecting the row", async () => {
      const { onSelect, user } = setup({ providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })], selectOnRowClick: true });
      const cost = screen.getByRole("row", { name: /akash1a/ }).querySelector("[data-row-click-ignore]") as HTMLElement;
      expect(cost).toBeInTheDocument();

      await user.click(cost);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("leaves expired and never-bid rows inert", async () => {
      const { onSelect, user } = setup({
        providers: [
          closedOffer({ owner: "akash1c", bidId: "akash1c/1/1/1", location: "expired-region" }),
          unavailableOffer({ owner: "akash1b", location: "no-bid-region" })
        ],
        selectOnRowClick: true
      });

      await user.click(screen.getByText("expired-region"));
      await user.click(screen.getByText("no-bid-region"));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("picks the selected offer again when its row is clicked", async () => {
      const { onSelect, user } = setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", location: "selected-region" })],
        selectedBidId: "akash1a/1/1/1",
        selectOnRowClick: true
      });

      await user.click(screen.getByText("selected-region"));

      expect(onSelect).toHaveBeenCalledWith("akash1a/1/1/1");
    });

    it("keeps the selected offer's hidden button pickable for keyboard and assistive technology", async () => {
      const { onSelect, user } = setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" })],
        selectedBidId: "akash1a/1/1/1",
        selectOnRowClick: true
      });

      await user.click(screen.getByRole("button", { name: "Selected akash1a" }));

      expect(onSelect).toHaveBeenCalledWith("akash1a/1/1/1");
    });

    it("leaves rows inert while selection is turned off", async () => {
      const { onSelect, user } = setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1", location: "us-west" })],
        isSelectable: false,
        selectOnRowClick: true
      });

      await user.click(screen.getByText("us-west"));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("marks only the selected offer with a check before its name", () => {
      setup({ providers: twoSubmittedOffers(), selectedBidId: "akash1a/1/1/1", selectOnRowClick: true });

      expect(within(screen.getByRole("row", { name: /akash1a/ })).getByRole("img", { name: "Selected provider" })).toBeInTheDocument();
      expect(within(screen.getByRole("row", { name: /akash1b/ })).queryByRole("img", { name: "Selected provider" })).not.toBeInTheDocument();
    });

    it("marks no offer before a bid is picked", () => {
      setup({ providers: [searchingOffer({ owner: "akash1a" })], selectOnRowClick: true });

      expect(screen.queryByRole("img", { name: "Selected provider" })).not.toBeInTheDocument();
    });

    it("moves the check when another offer gets selected", () => {
      const { selectBid } = setup({ providers: twoSubmittedOffers(), selectedBidId: "akash1a/1/1/1", selectOnRowClick: true });

      selectBid("akash1b/1/1/1");

      expect(within(screen.getByRole("row", { name: /akash1b/ })).getByRole("img", { name: "Selected provider" })).toBeInTheDocument();
    });

    it("gives a pointer only to the rows a click would select", () => {
      setup({
        providers: [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), closedOffer({ owner: "akash1c", bidId: "akash1c/1/1/1" })],
        selectedBidId: "akash1a/1/1/1",
        selectOnRowClick: true
      });

      expect(screen.getByRole("row", { name: /akash1a/ })).toHaveClass("cursor-pointer");
      expect(screen.getByRole("row", { name: /akash1c/ })).not.toHaveClass("cursor-pointer");
    });

    function twoSubmittedOffers() {
      return [submittedOffer({ owner: "akash1a", bidId: "akash1a/1/1/1" }), submittedOffer({ owner: "akash1b", bidId: "akash1b/1/1/1" })];
    }
  });

  function setup(input: {
    providers: PlacementOffer[];
    isBusy?: boolean;
    isLoading?: boolean;
    isSearchActive?: boolean;
    onClearSearch?: () => void;
    selectedBidId?: string;
    isSelectable?: boolean;
    gpuCount?: number;
    showProviderLink?: boolean;
    emptyMessage?: string;
    gpuVendors?: GpuVendor[];
    selectOnRowClick?: boolean;
  }) {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const table = (selectedBidId: string | undefined) => (
      <TestContainerProvider>
        <IntlProvider locale="en">
          <TooltipProvider>
            <MarketplaceProvidersTable
              providers={input.providers}
              isBusy={input.isBusy}
              isLoading={input.isLoading}
              isSearchActive={input.isSearchActive}
              onClearSearch={input.onClearSearch}
              selectedBidId={selectedBidId}
              onSelect={onSelect}
              isSelectable={input.isSelectable}
              gpuCount={input.gpuCount}
              showProviderLink={input.showProviderLink ?? true}
              emptyMessage={input.emptyMessage}
              gpuVendors={input.gpuVendors}
              selectOnRowClick={input.selectOnRowClick}
            />
          </TooltipProvider>
        </IntlProvider>
      </TestContainerProvider>
    );
    const { rerender } = render(table(input.selectedBidId));
    return { onSelect, user, selectBid: (bidId: string) => rerender(table(bidId)) };
  }
});
