import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { format, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { MarketplaceProvidersTable } from "./MarketplaceProvidersTable";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe("MarketplaceProvidersTable", () => {
  it("renders a row per provider showing host and region", () => {
    setup({
      providers: [
        buildScreenedProvider({ hostUri: "https://a.example:8443", location: "us-west" }),
        buildScreenedProvider({ hostUri: "https://b.example:8443", location: "eu-central" })
      ]
    });

    expect(screen.getByText("a.example")).toBeInTheDocument();
    expect(screen.getByText("us-west")).toBeInTheDocument();
    expect(screen.getByText("b.example")).toBeInTheDocument();
    expect(screen.getByText("eu-central")).toBeInTheDocument();
  });

  it("renders an em dash when region is null", () => {
    setup({ providers: [buildScreenedProvider({ hostUri: "https://a.example:8443", location: null })] });

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("sorts rows by provider host when the Provider header is toggled ascending", async () => {
    setup({
      providers: [buildScreenedProvider({ hostUri: "https://zeta.example:8443" }), buildScreenedProvider({ hostUri: "https://alpha.example:8443" })]
    });

    await userEvent.click(screen.getByRole("button", { name: /Provider/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alpha.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("zeta.example")).toBeInTheDocument();
  });

  it("sorts by the displayed hostname regardless of scheme or port", async () => {
    setup({
      providers: [buildScreenedProvider({ hostUri: "http://zeta.example:80" }), buildScreenedProvider({ hostUri: "https://alpha.example:8443" })]
    });

    await userEvent.click(screen.getByRole("button", { name: /Provider/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alpha.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("zeta.example")).toBeInTheDocument();
  });

  it("sorts rows by derived uptime when the Uptime header is toggled ascending", async () => {
    const recentDay = format(subDays(new Date(), 2), "yyyy-MM-dd");
    const downProvider = buildScreenedProvider({
      owner: "akash1down",
      hostUri: "https://down.example:8443",
      incidents: [{ date: recentDay, hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 24 * 60 * 60 }]
    });
    const upProvider = buildScreenedProvider({ owner: "akash1up", hostUri: "https://up.example:8443", incidents: [] });
    setup({ providers: [upProvider, downProvider] });

    await userEvent.click(screen.getByRole("button", { name: /Uptime/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("down.example")).toBeInTheDocument();
    expect(within(rows[2]).getByText("up.example")).toBeInTheDocument();
  });

  it("displays the organization name when present", () => {
    setup({ providers: [buildScreenedProvider({ organization: "Polaris Compute", hostUri: "https://a.example:8443" })] });

    expect(screen.getByText("Polaris Compute")).toBeInTheDocument();
  });

  it("falls back to the host name when organization is absent", () => {
    setup({ providers: [buildScreenedProvider({ organization: null, hostUri: "https://a.example:8443" })] });

    expect(screen.getByText("a.example")).toBeInTheDocument();
  });

  it("falls back to the provider address when it has no host or organization (bid-sourced offer)", () => {
    setup({ providers: [buildScreenedProvider({ organization: null, hostUri: "", owner: "akash1bidder" })] });

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

  function setup(input: { providers: ScreenedProvider[]; isLoading?: boolean; isSearchActive?: boolean; onClearSearch?: () => void }) {
    return render(
      <IntlProvider locale="en">
        <TooltipProvider>
          <MarketplaceProvidersTable
            providers={input.providers}
            isLoading={input.isLoading}
            isSearchActive={input.isSearchActive}
            onClearSearch={input.onClearSearch}
          />
        </TooltipProvider>
      </IntlProvider>
    );
  }
});
