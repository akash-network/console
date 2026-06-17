import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

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

  function setup(input: { providers: ScreenedProvider[] }) {
    return render(
      <TooltipProvider>
        <MarketplaceProvidersTable providers={input.providers} />
      </TooltipProvider>
    );
  }
});
