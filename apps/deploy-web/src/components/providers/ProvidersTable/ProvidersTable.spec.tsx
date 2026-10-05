import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProviderSummary } from "@src/components/providers/providerSummary/providerSummary";
import { ProvidersTable } from "./ProvidersTable";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ProvidersTable", () => {
  it("lists each provider with its region, GPUs, capacity and uptime", () => {
    setup({
      providers: [
        createSummary({
          owner: "akash1gpu",
          name: "provider.gpu.example.com",
          locationRegion: "eu-central",
          gpuCount: 8,
          gpuModels: ["h100", "a100", "t4"],
          vcpuCount: 128,
          memoryBytes: 512e9,
          uptime30d: 0.9995
        })
      ]
    });

    const row = screen.getByRole("row", { name: /provider\.gpu\.example\.com/ });
    expect(within(row).getByText("akash1gpu")).toBeInTheDocument();
    expect(within(row).getByText("EU Central")).toBeInTheDocument();
    expect(within(row).getByText("H100")).toBeInTheDocument();
    expect(within(row).getByText("+2")).toBeInTheDocument();
    expect(within(row).getByTitle("H100, A100, T4")).toBeInTheDocument();
    expect(within(row).getByText("8")).toBeInTheDocument();
    expect(within(row).getByText("128 vCPU · 512 GB")).toBeInTheDocument();
    expect(within(row).getByText("99.95%")).toBeInTheDocument();
  });

  it("shows a provider's only GPU model without counting other models", () => {
    setup({ providers: [createSummary({ gpuCount: 2, gpuModels: ["h100"] })] });

    expect(screen.getByTitle("H100")).toHaveTextContent(/^H100$/);
  });

  it("marks a provider without GPUs, region or measured uptime", () => {
    setup({ providers: [createSummary({ gpuCount: 0, gpuModels: [], locationRegion: null, uptime30d: null })] });

    const row = screen.getByRole("row", { name: /provider\.example\.com/ });
    expect(within(row).getByText("CPU only")).toBeInTheDocument();
    expect(within(row).getAllByLabelText("None")).toHaveLength(3);
  });

  it("shows only the providers' rows once they are loaded", () => {
    setup({
      providers: [createSummary({ owner: "akash1first", name: "provider.first.com" }), createSummary({ owner: "akash1second", name: "provider.second.com" })]
    });

    expect(screen.getByRole("table", { name: "Providers" })).toHaveAttribute("aria-busy", "false");
    expect(getBodyRows()).toHaveLength(2);
    expect(screen.queryByText("No providers match those filters.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("puts the region and GPU filters in the column headers", () => {
    setup({ providers: [createSummary()], regionFilter: <button type="button">Region filter</button>, gpuFilter: <button type="button">GPU filter</button> });

    expect(screen.getByRole("columnheader", { name: "Region filter" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "GPU filter" })).toBeInTheDocument();
  });

  it("shows the column headers on wide screens", () => {
    setup({ providers: [createSummary()] });

    expect(getHeaderRowGroup()).not.toHaveClass("sr-only");
  });

  it("highlights the selected provider's row", () => {
    setup({
      providers: [createSummary({ owner: "akash1first", name: "provider.first.com" }), createSummary({ owner: "akash1second", name: "provider.second.com" })],
      selectedOwner: "akash1second"
    });

    expect(screen.getByRole("row", { name: /provider\.second\.com/ })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("row", { name: /provider\.first\.com/ })).toHaveAttribute("data-selected", "false");
  });

  it("opens a provider's summary from its row and from its name", async () => {
    const provider = createSummary({ owner: "akash1row", name: "provider.row.com" });
    const { onSelect } = setup({ providers: [provider] });

    await userEvent.click(screen.getByText("akash1row"));
    await userEvent.click(screen.getByRole("button", { name: "provider.row.com" }));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, provider);
    expect(onSelect).toHaveBeenNthCalledWith(2, provider);
  });

  it("adds a provider to the favorites without opening it", async () => {
    const { onSelect, onToggleFavorite } = setup({ providers: [createSummary({ owner: "akash1liked", name: "provider.liked.com" })] });

    await userEvent.click(screen.getByRole("button", { name: "Add provider.liked.com to favorites" }));

    expect(onToggleFavorite).toHaveBeenCalledExactlyOnceWith("akash1liked");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers to remove a favorite provider from the favorites", () => {
    setup({ providers: [createSummary({ owner: "akash1liked", name: "provider.liked.com" })], favoriteProviders: ["akash1liked"] });

    expect(screen.getByRole("button", { name: "Remove provider.liked.com from favorites" })).toBeInTheDocument();
  });

  it("says when no provider matches the filters", () => {
    setup({ providers: [], status: "ready", matchingProviderCount: 0 });

    expect(screen.getByText("No providers match those filters.")).toBeInTheDocument();
    expect(getBodyRows()).toHaveLength(1);
  });

  it("shows placeholder rows across every column while the first page loads", () => {
    setup({ providers: [], status: "loading", matchingProviderCount: 0 });

    expect(screen.getByRole("table", { name: "Providers" })).toHaveAttribute("aria-busy", "true");
    expect(getBodyRows().map(row => within(row).getAllByRole("cell").length)).toEqual([7, 7, 7, 7]);
    expect(screen.queryByText("No providers match those filters.")).not.toBeInTheDocument();
  });

  it("shows two-column placeholder rows on narrow screens", () => {
    setup({ providers: [], status: "loading", matchingProviderCount: 0, isCompact: true });

    expect(getBodyRows().map(row => within(row).getAllByRole("cell").length)).toEqual([2, 2, 2, 2]);
  });

  it("keeps the current rows instead of placeholders while another page loads", () => {
    setup({ providers: [createSummary()], status: "loading", matchingProviderCount: 33, pageIndex: 1, pageCount: 4 });

    expect(screen.getByRole("table", { name: "Providers" })).toHaveAttribute("aria-busy", "true");
    expect(getBodyRows()).toHaveLength(1);
    expect(screen.getByRole("row", { name: /provider\.example\.com/ })).toBeInTheDocument();
  });

  it("offers a retry when the providers can't be loaded", async () => {
    const { onRetry } = setup({ providers: [], status: "failed", matchingProviderCount: 0 });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load providers.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the pages when the providers can't be loaded", () => {
    setup({ providers: [], status: "failed", matchingProviderCount: 33, pageIndex: 1, pageCount: 4 });

    expect(screen.queryByRole("navigation", { name: "Providers pages" })).not.toBeInTheDocument();
  });

  it("pages through the providers ten at a time", async () => {
    const { onPageChange } = setup({ providers: [createSummary()], matchingProviderCount: 33, pageIndex: 1, pageCount: 4 });

    const pages = screen.getByRole("navigation", { name: "Providers pages" });
    expect(within(pages).getByText("11–20 of 33")).toBeInTheDocument();
    expect(within(pages).getByText("2 / 4")).toBeInTheDocument();
    await userEvent.click(within(pages).getByRole("button", { name: "Previous" }));
    await userEvent.click(within(pages).getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 0);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
  });

  it("can't page before the first page or past the last one", () => {
    setup({ providers: [createSummary()], matchingProviderCount: 13, pageIndex: 1, pageCount: 2 });

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("11–13 of 13")).toBeInTheDocument();
  });

  it("can't go back from the first page", () => {
    setup({ providers: [createSummary()], matchingProviderCount: 13, pageIndex: 0, pageCount: 2 });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("hides the pages when they all fit on one", () => {
    setup({ providers: [createSummary()], matchingProviderCount: 10, pageCount: 1 });

    expect(screen.queryByRole("navigation", { name: "Providers pages" })).not.toBeInTheDocument();
  });

  it("folds a provider's region, GPUs and uptime under its name on narrow screens", () => {
    setup({
      isCompact: true,
      providers: [
        createSummary({ name: "provider.narrow.com", locationRegion: "eu-central", gpuCount: 19, gpuModels: ["rtx4000ada", "v100", "t4"], uptime30d: 0.99 })
      ],
      regionFilter: <button type="button">Region filter</button>
    });

    const row = screen.getByRole("row", { name: /provider\.narrow\.com/ });
    expect(within(row).getByText("EU Central")).toBeInTheDocument();
    expect(within(row).getByText("19× RTX4000ADA +2")).toBeInTheDocument();
    expect(within(row).getByText("99%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Region filter" })).not.toBeInTheDocument();
    expect(getHeaderRowGroup()).toHaveClass("sr-only");
  });

  it("names a narrow row's GPUs plainly when it has one model, no model or none at all", () => {
    setup({
      isCompact: true,
      providers: [
        createSummary({ owner: "akash1one", name: "provider.one.com", gpuCount: 2, gpuModels: ["t4"] }),
        createSummary({ owner: "akash1unknown", name: "provider.unknown.com", gpuCount: 1, gpuModels: [] }),
        createSummary({ owner: "akash1cpu", name: "provider.cpu.com", gpuCount: 0, gpuModels: [] })
      ]
    });

    expect(screen.getByText("2× T4")).toBeInTheDocument();
    expect(screen.getByText("1× GPU")).toBeInTheDocument();
    expect(screen.getByText("CPU only")).toBeInTheDocument();
  });

  function createSummary(overrides: Partial<ProviderSummary> = {}): ProviderSummary {
    return {
      owner: "akash1provider",
      name: "provider.example.com",
      hostUri: "https://provider.example.com:8443",
      location: "Missouri, US",
      locationRegion: "na-us-midwest",
      isAudited: true,
      uptime30d: 0.995,
      gpuCount: 0,
      gpuModels: [],
      vcpuCount: 16,
      memoryBytes: 64e9,
      storageBytes: 1e12,
      coordinates: null,
      ...overrides
    };
  }

  function getHeaderRowGroup() {
    const [header] = screen.getAllByRole("rowgroup");
    return header;
  }

  function getBodyRows() {
    const [, body] = screen.getAllByRole("rowgroup");
    return within(body).getAllByRole("row");
  }

  function setup(input: Partial<ComponentProps<typeof ProvidersTable>> & { providers: ProviderSummary[] }) {
    const onSelect = vi.fn();
    const onToggleFavorite = vi.fn();
    const onPageChange = vi.fn();
    const onRetry = vi.fn();
    render(
      <ProvidersTable
        status="ready"
        matchingProviderCount={input.providers.length}
        pageIndex={0}
        pageCount={1}
        selectedOwner={null}
        favoriteProviders={[]}
        isCompact={false}
        regionFilter="Region"
        gpuFilter="GPU"
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onPageChange={onPageChange}
        onRetry={onRetry}
        {...input}
      />
    );
    return { onSelect, onToggleFavorite, onPageChange, onRetry };
  }
});
