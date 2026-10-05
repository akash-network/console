import { describe, expect, it, vi } from "vitest";

import type { ProviderSummary } from "@src/components/providers/providerSummary/providerSummary";
import { UrlService } from "@src/utils/urlUtils";
import { ProviderPanel } from "./ProviderPanel";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ProviderPanel", () => {
  it("lists every provider at a shared location with what each runs", () => {
    setup({
      title: "Missouri, US",
      providers: [
        createSummary({ owner: "akash1gpu", name: "provider.gpu.example.com", gpuCount: 8, gpuModels: ["h100", "a100"] }),
        createSummary({ owner: "akash1cpu", name: "provider.cpu.example.com", gpuCount: 0, vcpuCount: 64, location: null })
      ]
    });

    const list = screen.getByRole("list", { name: "Providers at this location" });
    expect(screen.getByRole("heading", { name: "Missouri, US" })).toBeInTheDocument();
    expect(screen.getByText("2 providers here · 8 GPUs. Zoom in to separate them on the globe.")).toBeInTheDocument();
    expect(within(list).getByText("Missouri, US · 8× H100/A100")).toBeInTheDocument();
    expect(within(list).getByText("64 vCPU")).toBeInTheDocument();
  });

  it("leaves the GPUs out of a location's summary when none of its providers runs one", () => {
    setup({ providers: [createSummary({ owner: "akash1a", gpuCount: 0 }), createSummary({ owner: "akash1b", gpuCount: 0 })] });

    expect(screen.getByText("2 providers here. Zoom in to separate them on the globe.")).toBeInTheDocument();
  });

  it("names a GPU provider's GPUs generically when their model is unknown", () => {
    setup({ providers: [createSummary({ owner: "akash1a", gpuCount: 4, gpuModels: [], location: null }), createSummary({ owner: "akash1b" })] });

    expect(within(screen.getByRole("list", { name: "Providers at this location" })).getByText("4× GPU")).toBeInTheDocument();
  });

  it("opens a provider picked from the location's list", async () => {
    const provider = createSummary({ owner: "akash1picked", name: "provider.picked.com" });
    const { onSelect } = setup({ providers: [provider, createSummary({ owner: "akash1other" })] });

    await userEvent.click(screen.getByRole("button", { name: /provider\.picked\.com/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(provider);
  });

  it("summarizes the selected provider and links to its full profile", () => {
    const provider = createSummary({
      owner: "akash1selected",
      name: "provider.selected.com",
      locationRegion: "eu-central",
      isAudited: true,
      location: "Hesse, DE",
      gpuCount: 4,
      gpuModels: ["h100"],
      uptime30d: 0.9995,
      vcpuCount: 128,
      memoryBytes: 512e9,
      storageBytes: 2e12
    });
    setup({ providers: [provider], selected: provider });

    expect(screen.getByRole("heading", { name: "provider.selected.com" })).toBeInTheDocument();
    expect(screen.getByText("akash1selected")).toBeInTheDocument();
    expect(screen.getByText("EU Central")).toBeInTheDocument();
    expect(screen.getByText("Audited")).toBeInTheDocument();
    expect(screen.getByText("Hesse, DE")).toBeInTheDocument();
    expect(screen.getByText("4×")).toBeInTheDocument();
    expect(screen.getByText("H100")).toBeInTheDocument();
    expect(screen.getByText("99.95%")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("512 GB")).toBeInTheDocument();
    expect(screen.getByText("2 TB disk")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full profile" })).toHaveAttribute("href", UrlService.providerDetail("akash1selected"));
  });

  it("says when a provider runs no GPU, has no measured uptime and no known location", () => {
    const provider = createSummary({ gpuCount: 0, gpuModels: [], uptime30d: null, location: null, locationRegion: null, isAudited: false });
    setup({ providers: [provider], selected: provider });

    expect(screen.getByText("CPU only")).toBeInTheDocument();
    expect(screen.getByText("Not measured yet")).toBeInTheDocument();
    expect(screen.getByText("Location unknown")).toBeInTheDocument();
    expect(screen.queryByText("Audited")).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition").map(definition => definition.textContent)).toEqual([
      "—",
      "CPU only",
      "—",
      "Not measured yet",
      "16",
      "Total capacity",
      "64 GB",
      "1 TB disk"
    ]);
  });

  it("lists every GPU model a provider runs", () => {
    const provider = createSummary({ gpuCount: 8, gpuModels: ["h100", "a100"] });
    setup({ providers: [provider], selected: provider });

    expect(screen.getByText("H100, A100")).toBeInTheDocument();
  });

  it("shows the region of an unaudited provider", () => {
    const provider = createSummary({ locationRegion: "eu-central", isAudited: false });
    setup({ providers: [provider], selected: provider });

    expect(screen.getByText("EU Central")).toBeInTheDocument();
    expect(screen.queryByText("Audited")).not.toBeInTheDocument();
  });

  it("adds the selected provider to the favorites", async () => {
    const provider = createSummary({ owner: "akash1liked" });
    const { onToggleFavorite } = setup({ providers: [provider], selected: provider });

    await userEvent.click(screen.getByRole("button", { name: "Add to favorites" }));

    expect(onToggleFavorite).toHaveBeenCalledExactlyOnceWith("akash1liked");
    expect(screen.getByRole("button", { name: "Add to favorites" }).querySelector("svg")).not.toHaveClass("fill-amber-400");
  });

  it("offers to remove a favorite provider from the favorites and fills its star", () => {
    const provider = createSummary({ owner: "akash1liked" });
    setup({ providers: [provider], selected: provider, favoriteProviders: ["akash1liked"] });

    expect(screen.getByRole("button", { name: "Remove from favorites" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from favorites" }).querySelector("svg")).toHaveClass("fill-amber-400", "text-amber-400");
  });

  it("goes back to the location's list from a provider picked in it", async () => {
    const provider = createSummary({ owner: "akash1picked" });
    const { onBack } = setup({ providers: [provider, createSummary({ owner: "akash1other" })], selected: provider });

    await userEvent.click(screen.getByRole("button", { name: "Back to this location" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers no way back for a provider alone at its location", () => {
    const provider = createSummary({ owner: "akash1alone" });
    setup({ providers: [provider], selected: provider });

    expect(screen.queryByRole("button", { name: "Back to this location" })).not.toBeInTheDocument();
  });

  it("closes", async () => {
    const { onClose } = setup({ providers: [createSummary(), createSummary({ owner: "akash1other" })] });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
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
      coordinates: { lat: 38.6, lng: -90.2 },
      ...overrides
    };
  }

  function setup(input: { title?: string; providers: ProviderSummary[]; selected?: ProviderSummary | null; favoriteProviders?: string[] }) {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const onClose = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <ProviderPanel
        title={input.title ?? "Somewhere"}
        providers={input.providers}
        selected={input.selected ?? null}
        favoriteProviders={input.favoriteProviders ?? []}
        onSelect={onSelect}
        onBack={onBack}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite}
      />
    );
    return { onSelect, onBack, onClose, onToggleFavorite };
  }
});
