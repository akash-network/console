import yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentDetailHeader } from "./DeploymentDetailHeader";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetailHeader", () => {
  it("counts the services of every placement, not just the one whose status is loaded", () => {
    setup({
      storedManifest: yaml.dump({
        services: { web: {}, api: {}, worker: {} },
        deployment: { web: { "dcloud-us": {} }, api: { "dcloud-us": {} }, worker: { "dcloud-eu": {} } }
      }),
      leases: [buildLeaseInPlacement("1", "dcloud-us"), buildLeaseInPlacement("2", "dcloud-eu")]
    });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("falls back to the placement count when no manifest is stored locally", () => {
    setup({
      storedManifest: null,
      leases: [buildLeaseInPlacement("1", "dcloud-us"), buildLeaseInPlacement("2", "dcloud-eu"), buildLeaseInPlacement("3", "dcloud-ap")]
    });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the deployment name from local notes", () => {
    setup({ name: "My Storefront" });

    expect(screen.getByText("My Storefront")).toBeInTheDocument();
  });

  it("falls back to a generated name when none is stored", () => {
    setup({ name: null });

    expect(screen.getByText("Deployment #1786440078202")).toBeInTheDocument();
  });

  it("shows the running status badge when the deployment is active", () => {
    setup({});

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("opens the rename flow when the edit-name button is clicked", async () => {
    const { changeDeploymentName } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Edit deployment name" }));

    expect(changeDeploymentName).toHaveBeenCalledWith("1786440078202");
  });

  it("shows auto top-up as active when enabled for the deployment", () => {
    setup({ autoTopUpEnabled: true });

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows auto top-up as off when disabled for the deployment", () => {
    setup({ autoTopUpEnabled: false });

    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("shows the runtime limit tile when the deployment has one", () => {
    setup({ runtimeLimitHours: 12 });

    expect(screen.getByText("RUNTIME LIMIT")).toBeInTheDocument();
    expect(screen.getByText("12h")).toBeInTheDocument();
  });

  it("keeps the remaining-time label ticking as time passes, without any query refetch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:00:00.000Z" });

      expect(screen.getByText("12h · ~2h left")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
      });
      expect(screen.getByText("12h · ~1h left")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      });
      expect(screen.getByText("12h · reached")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the runtime limit tile when the deployment has none", () => {
    setup({});

    expect(screen.queryByText("RUNTIME LIMIT")).not.toBeInTheDocument();
  });

  it("replaces the auto top-up tile with the runtime limit tile, never showing both", () => {
    setup({ runtimeLimitHours: 12, autoTopUpEnabled: true });

    expect(screen.getByText("RUNTIME LIMIT")).toBeInTheDocument();
    expect(screen.queryByText("AUTO TOP-UP")).not.toBeInTheDocument();
  });

  it("shows the auto top-up tile when the deployment has no runtime limit", () => {
    setup({ autoTopUpEnabled: true });

    expect(screen.getByText("AUTO TOP-UP")).toBeInTheDocument();
  });

  it("shows the deployment's own escrow balance rather than the account-wide wallet balance", () => {
    setup({ escrowBalanceUdenom: 3_720_000 });

    expect(screen.getByTestId("escrow-balance")).toHaveTextContent("3.72");
  });

  it("passes every lease and provider to the visit control", () => {
    const DeploymentVisitControl = vi.fn(() => <div>visit</div>);
    const leases = [buildLeaseInPlacement("1", "dcloud-us"), buildLeaseInPlacement("2", "dcloud-eu")];
    const providers = [mock<ApiProviderList>({ owner: "akash1provider" })];
    setup({ leases, providers, dependencies: { DeploymentVisitControl } });

    expect(DeploymentVisitControl).toHaveBeenCalledWith(expect.objectContaining({ leases, providers }), {});
  });

  it("shows the trial badge when the wallet is trialing", () => {
    setup({ isTrialing: true });

    expect(screen.getByText("trial-badge")).toBeInTheDocument();
  });

  it("hides the trial badge when the wallet is not trialing", () => {
    setup({ isTrialing: false });

    expect(screen.queryByText("trial-badge")).not.toBeInTheDocument();
  });

  it("shows the confidential compute and gpu interconnect badges for the declared groups", () => {
    setup({});

    expect(screen.getByText("tee-badge")).toBeInTheDocument();
    expect(screen.getByText("interconnect-badge")).toBeInTheDocument();
  });

  it("prices the deployment hourly when a live lease is running on GPU", () => {
    const { CostRate } = setup({
      leases: [buildPricedLease({ state: "active", amount: "4000", gpuAmount: 2 })]
    });

    expect(CostRate).toHaveBeenCalledWith(expect.objectContaining({ perBlockUDenom: 4000, gpuCount: 2 }), {});
  });

  it("leaves closed leases out of the cost, so a partly torn-down deployment doesn't over-report", () => {
    const { CostRate } = setup({
      leases: [buildPricedLease({ state: "active", amount: "4000", gpuAmount: 1 }), buildPricedLease({ state: "closed", amount: "9000", gpuAmount: 1 })]
    });

    expect(CostRate).toHaveBeenCalledWith(expect.objectContaining({ perBlockUDenom: 4000, gpuCount: 1 }), {});
  });

  it("shows no cost when every lease is closed", () => {
    const { CostRate } = setup({ leases: [buildPricedLease({ state: "closed", amount: "9000", gpuAmount: 1 })] });

    expect(CostRate).not.toHaveBeenCalled();
  });

  it("keeps redeploy off the header now that it lives on the update tab", () => {
    setup({ storedManifest: "version: '2.0'" });

    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("shows the gpu count and model in the summary", () => {
    setup({
      gpuAmount: 1,
      groups: [
        mock<DeploymentGroup>({
          group_spec: { resources: [{ resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] } } }] }
        } as Partial<DeploymentGroup>)
      ]
    });

    expect(screen.getByText("H100")).toBeInTheDocument();
  });

  it("shows an em dash for gpu when the deployment has none", () => {
    setup({ gpuAmount: 0 });

    expect(screen.getByText("GPU").parentElement).toHaveTextContent("—");
  });

  function buildPricedLease(input: { state: string; amount: string; gpuAmount: number }) {
    return mock<LeaseDto>({
      id: input.amount,
      provider: "akash1provider",
      state: input.state,
      reason: "lease_closed_owner",
      gpuAmount: input.gpuAmount,
      price: { denom: "uact", amount: input.amount }
    });
  }

  function buildLeaseInPlacement(id: string, placementName: string) {
    return mock<LeaseDto>({
      id,
      provider: "akash1provider",
      state: "active",
      group: mock<DeploymentGroup>({ group_spec: { name: placementName } } as Partial<DeploymentGroup>)
    });
  }

  function setup(input: {
    autoTopUpEnabled?: boolean;
    escrowBalanceUdenom?: number;
    runtimeLimitHours?: number | null;
    runtimeEndsAt?: string | null;
    name?: string | null;
    isTrialing?: boolean;
    storedManifest?: string | null;
    leases?: LeaseDto[];
    providers?: ApiProviderList[];
    gpuAmount?: number;
    groups?: DeploymentGroup[];
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const changeDeploymentName = vi.fn();
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({
        getDeploymentName: () => input.name ?? null,
        changeDeploymentName,
        getDeploymentData: () => (input.storedManifest ? { manifest: input.storedManifest, name: input.name ?? undefined } : null)
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const useDeclaredTeeTypes: typeof DEPENDENCIES.useDeclaredTeeTypes = () => [];
    const useDeclaredGpuInterconnect: typeof DEPENDENCIES.useDeclaredGpuInterconnect = () => ({ enabled: false, fabrics: [] });
    const TrialDeploymentBadge = vi.fn(() => <div>trial-badge</div>);
    const ConfidentialComputeBadge = vi.fn(() => <div>tee-badge</div>);
    const GpuInterconnectBadge = vi.fn(() => <div>interconnect-badge</div>);
    const useDeploymentEscrowBalance: typeof DEPENDENCIES.useDeploymentEscrowBalance = () => ({
      balanceUdenom: input.escrowBalanceUdenom ?? 0,
      denom: "uact"
    });
    const PriceValue: typeof DEPENDENCIES.PriceValue = ({ value }) => <span data-testid="escrow-balance">{value}</span>;
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>>({
        data: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>["data"]>>({
          autoTopUpEnabled: input.autoTopUpEnabled ?? false,
          runtimeLimitHours: input.runtimeLimitHours ?? null,
          runtimeEndsAt: input.runtimeEndsAt ?? null
        })
      });
    const CostRate = vi.fn(() => <div>cost-rate</div>);
    const DeploymentVisitControl = vi.fn(() => <div>visit</div>);

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: "active",
      cpuAmount: 2,
      gpuAmount: input.gpuAmount ?? 0,
      memoryAmount: 536870912,
      storageAmount: 536870912,
      groups: input.groups ?? [],
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({ state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [] }) })
    });

    render(
      <DeploymentDetailHeader
        deployment={deployment}
        leases={input.leases ?? [mock<LeaseDto>({ id: "1", provider: "akash1provider", state: "active" })]}
        providers={input.providers ?? [mock<ApiProviderList>({ owner: "akash1provider" })]}
        dependencies={MockComponents(DEPENDENCIES, {
          useLocalNotes,
          useWallet,
          useDeploymentEscrowBalance,
          PriceValue,
          useDeploymentSettingQuery,
          useDeclaredTeeTypes,
          useDeclaredGpuInterconnect,
          TrialDeploymentBadge,
          ConfidentialComputeBadge,
          GpuInterconnectBadge,
          CostRate,
          DeploymentVisitControl,
          ...input.dependencies
        })}
      />
    );

    return { changeDeploymentName, CostRate, PriceValue };
  }
});
