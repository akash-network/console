import type { ReactNode } from "react";
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

  it("shows the limit alone, with no meter, before the countdown is anchored to a lease", () => {
    setup({ runtimeLimitHours: 12 });

    expect(screen.getByText("RUNTIME LIMIT")).toBeInTheDocument();
    expect(screen.getByText("12h")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the remaining time and the limit it is measured against apart, rather than in one string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:00:00.000Z" });

      expect(screen.getByText("2h left")).toBeInTheDocument();
      expect(screen.getByText("12h")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "2h of 12h left");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the remaining time and its meter draining as time passes, without any query refetch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:00:00.000Z" });

      expect(screen.getByText("2h left")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "17");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
      });
      expect(screen.getByText("59m left")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "8");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      });
      expect(screen.getByText("Limit reached")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads as ended, with no meter, once the deployment is closed with time still on its limit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({ state: "closed", runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:00:00.000Z" });

      expect(screen.getByText("Runtime ended")).toBeInTheDocument();
      expect(screen.getByText("12h")).toBeInTheDocument();
      expect(screen.queryByText("2h left")).not.toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads as ended once every lease is closed, before the deployment itself is", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({
        runtimeLimitHours: 12,
        runtimeEndsAt: "2026-08-21T14:00:00.000Z",
        leases: [mock<LeaseDto>({ id: "1", provider: "akash1provider", state: "closed", reason: undefined })]
      });

      expect(screen.getByText("Runtime ended")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps counting down while the lease list is still loading, so an active deployment never flashes as ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    try {
      setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T14:00:00.000Z", leases: null });

      expect(screen.getByText("2h left")).toBeInTheDocument();
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

  describe("when escrow is abstracted behind the threshold flag", () => {
    it("hides the balance and auto top-up tiles on an always-on deployment", () => {
      setup({ escrowBalanceUdenom: 3_720_000, autoTopUpEnabled: true, isEscrowAbstracted: true });

      expect(screen.queryByText("BALANCE")).not.toBeInTheDocument();
      expect(screen.queryByTestId("escrow-balance")).not.toBeInTheDocument();
      expect(screen.queryByText("AUTO TOP-UP")).not.toBeInTheDocument();
      expect(screen.getByText("COST")).toBeInTheDocument();
    });

    it("keeps the runtime limit tile on a limited deployment", () => {
      setup({ runtimeLimitHours: 12, isEscrowAbstracted: true });

      expect(screen.getByText("RUNTIME LIMIT")).toBeInTheDocument();
      expect(screen.queryByText("BALANCE")).not.toBeInTheDocument();
    });
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

  it("hangs the cost breakdown tooltip off the COST label rather than the value", () => {
    const { CostRate, CostBreakdownTooltip } = setup({
      leases: [buildPricedLease({ state: "active", amount: "4000", gpuAmount: 2 })]
    });

    expect(screen.getByText("COST").parentElement).toHaveTextContent("cost-tooltip");
    expect(screen.getByText("COST").parentElement?.querySelector("svg")).toBeInTheDocument();
    expect(CostBreakdownTooltip).toHaveBeenCalledWith(expect.objectContaining({ perBlockUDenom: 4000, gpuCount: 2 }), {});
    expect(CostRate).toHaveBeenCalledWith(expect.objectContaining({ hideBreakdownTooltip: true }), {});
  });

  it("leaves closed leases out of the cost, so a partly torn-down deployment doesn't over-report", () => {
    const { CostRate } = setup({
      leases: [buildPricedLease({ state: "active", amount: "4000", gpuAmount: 1 }), buildPricedLease({ state: "closed", amount: "9000", gpuAmount: 1 })]
    });

    expect(CostRate).toHaveBeenCalledWith(expect.objectContaining({ perBlockUDenom: 4000, gpuCount: 1 }), {});
  });

  it("shows no cost and no breakdown tooltip when every lease is closed", () => {
    const { CostRate, CostBreakdownTooltip } = setup({ leases: [buildPricedLease({ state: "closed", amount: "9000", gpuAmount: 1 })] });

    expect(CostRate).not.toHaveBeenCalled();
    expect(CostBreakdownTooltip).not.toHaveBeenCalled();
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
    state?: string;
    leases?: LeaseDto[] | null;
    providers?: ApiProviderList[];
    gpuAmount?: number;
    groups?: DeploymentGroup[];
    isEscrowAbstracted?: boolean;
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
    const useIsEscrowAbstracted: typeof DEPENDENCIES.useIsEscrowAbstracted = () => input.isEscrowAbstracted ?? false;
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
    const CostBreakdownTooltip = vi.fn(({ children }: { children?: ReactNode }) => <span>cost-tooltip{children}</span>);
    const DeploymentVisitControl = vi.fn(() => <div>visit</div>);

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: input.state ?? "active",
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
        leases={input.leases !== undefined ? input.leases : [mock<LeaseDto>({ id: "1", provider: "akash1provider", state: "active" })]}
        providers={input.providers ?? [mock<ApiProviderList>({ owner: "akash1provider" })]}
        dependencies={MockComponents(DEPENDENCIES, {
          useLocalNotes,
          useWallet,
          useIsEscrowAbstracted,
          useDeploymentEscrowBalance,
          PriceValue,
          useDeploymentSettingQuery,
          useDeclaredTeeTypes,
          useDeclaredGpuInterconnect,
          TrialDeploymentBadge,
          ConfidentialComputeBadge,
          GpuInterconnectBadge,
          CostRate,
          CostBreakdownTooltip,
          DeploymentVisitControl,
          ...input.dependencies
        })}
      />
    );

    return { changeDeploymentName, CostRate, CostBreakdownTooltip, PriceValue };
  }
});
