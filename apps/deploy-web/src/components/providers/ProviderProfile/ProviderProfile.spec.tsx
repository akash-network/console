import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderDetail, StatsItem } from "@src/types/provider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, ProviderProfile } from "./ProviderProfile";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("ProviderProfile", () => {
  it("titles the page with the provider's name, region and audit, and links back to all providers", () => {
    setup({});

    expect(screen.getByRole("link", { name: "All providers" })).toHaveAttribute("href", UrlService.providers());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^provider\.h100\.example\.com$/);
    expect(screen.getByText("Audited")).toBeInTheDocument();
    expect(screen.getByText("EU Central")).toBeInTheDocument();
    expect(screen.getByText("Hesse, DE")).toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("names the page after the provider for search engines", () => {
    const { dependencies } = setup({});

    expect(dependencies.CustomNextSeo.mock.calls[0][0]).toMatchObject({
      title: "Provider provider.h100.example.com",
      url: `${domainName}${UrlService.providerDetail("akash1abcdefghijklmnopqrstuvwxyz123")}`
    });
  });

  it("offers to copy the provider's address and URI", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Copy provider address" })).toHaveTextContent(/^akash1abc…xyz123$/);
    expect(screen.getByRole("button", { name: "Copy provider URI" })).toHaveTextContent(/^provider\.h100\.example\.com:8443$/);
  });

  it("shows a plain HTTP provider URI without its scheme", () => {
    setup({ provider: { hostUri: "http://provider.example.com:8443" } });

    expect(screen.getByRole("button", { name: "Copy provider URI" })).toHaveTextContent(/^provider\.example\.com:8443$/);
  });

  it("adds the provider to the favorites", async () => {
    const { model } = setup({});
    const toggle = screen.getByRole("button", { name: "Add to favorites" });

    await userEvent.click(toggle);

    expect(model.toggleFavorite).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute("aria-label", "Add to favorites");
    expect(toggle).toHaveAttribute("title", "Add to favorites");
  });

  it("offers to remove a favorite provider from the favorites", () => {
    setup({ isFavorite: true });

    const toggle = screen.getByRole("button", { name: "Remove from favorites" });
    expect(toggle).toHaveAttribute("aria-label", "Remove from favorites");
    expect(toggle).toHaveAttribute("title", "Remove from favorites");
  });

  it("shows the GPUs free now with the CPU and memory also free", () => {
    setup({ provider: { stats: createStats({ gpu: [4, 28], cpu: [116_000, 900_000], memory: [7.5e12, 1e12] }) } });

    expect(card("Available now")).toHaveTextContent("4× GPU");
    expect(card("Available now")).toHaveTextContent("116 vCPU · 7.5 TB RAM also free");
    expect(within(card("Available now")).queryByText("at capacity")).not.toBeInTheDocument();
  });

  it("flags a GPU provider with no GPU free as at capacity", () => {
    setup({ provider: { stats: createStats({ gpu: [0, 8] }) } });

    expect(card("Available now")).toHaveTextContent("0× GPU");
    expect(within(card("Available now")).getByText("at capacity")).toBeInTheDocument();
  });

  it("shows the vCPU, memory and disk free on a CPU provider", () => {
    setup({ provider: { stats: createStats({ gpu: [0, 0], cpu: [41_000, 0], memory: [96e9, 0], ephemeral: [1e12, 0], persistent: [500e9, 0] }) } });

    expect(card("Available now")).toHaveTextContent("41 vCPU");
    expect(card("Available now")).toHaveTextContent("96 GB RAM · 1.5 TB disk free");
  });

  it("shows the uptime over 30 days, 7 days and 24 hours", () => {
    setup({ provider: { uptime30d: 0.9995, uptime7d: 0.99, uptime1d: 1 } });

    expect(card("Uptime")).toHaveTextContent("99.95%30d");
    expect(card("Uptime")).toHaveTextContent("7 days 99% · 24 hours 100%");
  });

  it.each([
    [86400, "1 day", "Notice before leased capacity is reclaimed"],
    [null, "None", "No notice before leased capacity is reclaimed"],
    [undefined, "—", "Can't be read right now"]
  ])("shows a reclamation window of %s as %s", (reclamationWindow, value, foot) => {
    setup({ provider: { reclamationWindow } });

    expect(card("Reclamation window")).toHaveTextContent(value);
    expect(card("Reclamation window")).toHaveTextContent(foot);
  });

  it("marks an inactive provider and says when it last answered", () => {
    const { dependencies } = setup({ isInactive: true, provider: { lastOnlineDate: "2026-10-02T18:27:11.000Z" } });

    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This provider is inactive. It last answered Console's checks on Oct 2, 2026.");
    expect(card("Available now")).toHaveTextContent("Nothing can be leased while the provider is offline");
    expect(dependencies.GpuInventoryCard.mock.calls[0][0]).toMatchObject({ isProviderOffline: true });
  });

  it("says an inactive provider that never answered hasn't answered", () => {
    setup({ isInactive: true, provider: { lastOnlineDate: null } });

    expect(screen.getByRole("status")).toHaveTextContent("It hasn't answered Console's checks.");
  });

  it("passes the inventory, trends, location, operator and attributes to their cards", () => {
    const { dependencies, model } = setup({});

    expect(dependencies.GpuInventoryCard.mock.calls[0][0]).toMatchObject({
      models: model.gpuModels,
      isLoading: false,
      isProviderOffline: false,
      freeVcpuCount: 8
    });
    expect(dependencies.LeaseTrendCard.mock.calls[0][0]).toMatchObject({ trend: model.leaseTrend });
    expect(dependencies.UptimeCard.mock.calls[0][0]).toMatchObject({ provider: model.provider });
    expect(dependencies.LocationCard.mock.calls[0][0]).toMatchObject({ provider: model.provider });
    expect(dependencies.OperatorCard.mock.calls[0][0]).toMatchObject({ provider: model.provider, kubeVersion: "1.32" });
    expect(dependencies.RawAttributesCard.mock.calls[0][0]).toMatchObject({ attributes: model.provider.attributes });
  });

  it("passes the GPU drivers seen on Console leases to the inventory", () => {
    const gpuDrivers = [{ driverVersion: "550.54.15", cudaVersion: "12.4", lastSeenDate: "2026-09-21" }];
    const { dependencies } = setup({ provider: { gpuDrivers } });

    expect(dependencies.GpuInventoryCard.mock.calls[0][0]).toMatchObject({ drivers: gpuDrivers });
  });

  it("lists the user's leases here only when there are some", () => {
    const leases = [Object.assign(mock<LeaseDto>(), { dseq: "1" })];
    const { dependencies } = setup({ myLeases: leases });

    expect(dependencies.YourLeasesCard.mock.calls[0][0]).toMatchObject({ leases });
  });

  it("leaves the user's leases out when there are none", () => {
    const { dependencies } = setup({ myLeases: [] });

    expect(dependencies.YourLeasesCard).not.toHaveBeenCalled();
  });

  function card(label: string) {
    return screen.getByRole("region", { name: label });
  }

  function createStats(input: {
    gpu?: [number, number];
    cpu?: [number, number];
    memory?: [number, number];
    ephemeral?: [number, number];
    persistent?: [number, number];
  }) {
    const item = ([available, active]: [number, number] = [0, 0]): StatsItem => ({ available, active, pending: 0, total: available + active });
    return {
      cpu: item(input.cpu ?? [8000, 0]),
      gpu: item(input.gpu),
      memory: item(input.memory ?? [16e9, 0]),
      storage: { ephemeral: item(input.ephemeral), persistent: item(input.persistent), total: item() }
    };
  }

  function setup(input: { provider?: Partial<ApiProviderDetail>; isInactive?: boolean; isFavorite?: boolean; myLeases?: LeaseDto[] }) {
    const provider = Object.assign(mock<ApiProviderDetail>(), {
      owner: "akash1abcdefghijklmnopqrstuvwxyz123",
      name: "provider.h100.example.com",
      hostUri: "https://provider.h100.example.com:8443",
      ipRegion: "Hesse",
      ipCountryCode: "DE",
      isAudited: true,
      locationRegion: "eu-central",
      lastOnlineDate: null,
      uptime30d: 0.99,
      uptime7d: 0.99,
      uptime1d: 0.99,
      reclamationWindow: 86400,
      gpuDrivers: [],
      attributes: [{ key: "region", value: "eu-central", auditedBy: [] }],
      stats: createStats({ gpu: [2, 6] }),
      ...input.provider
    });
    const model = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderProfileModel>>(), {
      provider,
      isInactive: !!input.isInactive,
      kubeVersion: "1.32",
      gpuModels: [],
      isLoadingGpus: false,
      leaseTrend: null,
      myLeases: input.myLeases ?? [],
      getDeploymentName: () => null,
      isFavorite: !!input.isFavorite,
      toggleFavorite: vi.fn()
    });
    const dependencies = MockComponents(DEPENDENCIES, { useProviderProfileModel: () => model });

    render(<ProviderProfile owner={provider.owner} initialProvider={provider} dependencies={dependencies} />);

    return { dependencies, model };
  }
});
