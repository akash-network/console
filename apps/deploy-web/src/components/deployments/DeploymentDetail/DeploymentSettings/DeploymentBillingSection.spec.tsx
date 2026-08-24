import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentBillingSection } from "./DeploymentBillingSection";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentBillingSection", () => {
  it("opens the deposit modal when Add funds is clicked on an active deployment", async () => {
    setup({ state: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Add funds" }));

    expect(screen.getByText("deposit-modal")).toBeInTheDocument();
  });

  it("enables auto top-up when the toggle is switched on", async () => {
    const { setEnabled } = setup({ state: "active", isEnabled: false });

    await userEvent.click(screen.getByRole("switch", { name: "Auto Top-Up" }));

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("hides Add funds and the auto top-up toggle when the deployment is closed", () => {
    setup({ state: "closed" });

    expect(screen.queryByRole("button", { name: "Add funds" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the escrow balance reported by the escrow hook", () => {
    setup({ state: "active", balanceUdenom: 500000 });

    expect(screen.getByTestId("current-balance")).toHaveTextContent("0.5");
  });

  describe("when the deployment has a runtime limit", () => {
    it("offers Add hours instead of Add funds", () => {
      setup({ state: "active", runtimeLimitHours: 12 });

      expect(screen.getByRole("button", { name: "Add hours" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add funds" })).not.toBeInTheDocument();
    });

    it("hides the auto top-up toggle, which the limit already governs", () => {
      setup({ state: "active", runtimeLimitHours: 12 });

      expect(screen.queryByRole("switch", { name: "Auto Top-Up" })).not.toBeInTheDocument();
    });

    it("shows the limit and its countdown under the balance", () => {
      setup({ state: "active", runtimeLimitHours: 12, runtimeEndsAt: null });

      expect(screen.getByText("Runtime limit: 12h")).toBeInTheDocument();
    });

    it("sends the new total when hours are added", async () => {
      const { mutateAsync, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: "Add hours" }));
      await userEvent.click(screen.getByRole("button", { name: "submit-hours" }));

      expect(mutateAsync).toHaveBeenCalledWith({ runtimeLimitHours: 18 });
      await waitFor(() => expect(onFundsChanged).toHaveBeenCalled());
    });

    it("tracks the extension once it lands", async () => {
      const { analyticsService } = setup({ state: "active", runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: "Add hours" }));
      await userEvent.click(screen.getByRole("button", { name: "submit-hours" }));

      await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("add_runtime_hours", expect.anything()));
    });

    it("surfaces a rejected extension and leaves the modal open", async () => {
      const { enqueueSnackbar, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12, patchError: new Error("too far") });

      await userEvent.click(screen.getByRole("button", { name: "Add hours" }));
      await userEvent.click(screen.getByRole("button", { name: "submit-hours" }));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      expect(onFundsChanged).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "submit-hours" })).toBeInTheDocument();
    });

    it("removes the limit and turns auto top-up on once the switch is confirmed", async () => {
      const { mutateAsync, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: "Switch to always on" }));

      expect(mutateAsync).toHaveBeenCalledWith({ runtimeLimitHours: null, autoTopUpEnabled: true });
      await waitFor(() => expect(onFundsChanged).toHaveBeenCalled());
    });

    it("tracks the switch once it lands", async () => {
      const { analyticsService } = setup({ state: "active", runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: "Switch to always on" }));

      await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("remove_runtime_limit", expect.anything()));
    });

    it("leaves the limit alone when the switch is not confirmed", async () => {
      const { mutateAsync, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12, isConfirmed: false });

      await userEvent.click(screen.getByRole("button", { name: "Switch to always on" }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onFundsChanged).not.toHaveBeenCalled();
    });

    it("surfaces a rejected switch", async () => {
      const { enqueueSnackbar, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12, patchError: new Error("closed") });

      await userEvent.click(screen.getByRole("button", { name: "Switch to always on" }));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      expect(onFundsChanged).not.toHaveBeenCalled();
    });
  });

  it("does not offer a switch to always on when the deployment has no runtime limit", () => {
    setup({ state: "active" });

    expect(screen.queryByRole("button", { name: "Switch to always on" })).not.toBeInTheDocument();
  });

  function setup(input: {
    state?: string;
    isEnabled?: boolean;
    balanceUdenom?: number;
    leases?: LeaseDto[] | null;
    runtimeLimitHours?: number;
    runtimeEndsAt?: string | null;
    patchError?: Error;
    isConfirmed?: boolean;
  }) {
    const setEnabled = vi.fn();
    const deposit = vi.fn();
    const onFundsChanged = vi.fn();

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ denom: "uakt" });
    const usePricing: typeof DEPENDENCIES.usePricing = () => mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd: () => 0 });
    const useAutoTopUp: typeof DEPENDENCIES.useAutoTopUp = () =>
      mock<ReturnType<typeof DEPENDENCIES.useAutoTopUp>>({
        isEnabled: input.isEnabled ?? false,
        isLoading: false,
        estimatedTopUpAmount: 0,
        topUpFrequencyMs: 0,
        runtimeLimitHours: input.runtimeLimitHours ?? null,
        runtimeEndsAt: input.runtimeEndsAt ?? null,
        costPerBlockUdenom: 100,
        setEnabled,
        deposit
      });
    const useDeploymentEscrowBalance: typeof DEPENDENCIES.useDeploymentEscrowBalance = () => ({
      balanceUdenom: input.balanceUdenom ?? 1000000,
      denom: "uakt"
    });
    const useTickingNow: typeof DEPENDENCIES.useTickingNow = () => Date.parse("2026-08-21T12:00:00.000Z");

    const mutateAsync = vi.fn().mockImplementation(() => (input.patchError ? Promise.reject(input.patchError) : Promise.resolve()));
    const mutation = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>(), { mutateAsync, isPending: false });
    const useUpdateDeploymentSettingMutation: typeof DEPENDENCIES.useUpdateDeploymentSettingMutation = () => mutation;

    const confirm = vi.fn().mockResolvedValue(input.isConfirmed ?? true);
    const usePopup: typeof DEPENDENCIES.usePopup = () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm });

    const enqueueSnackbar = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const Snackbar: typeof DEPENDENCIES.Snackbar = ({ title }) => <span>{title}</span>;

    const DeploymentDepositModal = vi.fn(() => <div>deposit-modal</div>);
    const AddRuntimeHoursModal: typeof DEPENDENCIES.AddRuntimeHoursModal = ({ currentLimitHours, onSubmit }) => (
      <button onClick={() => onSubmit(currentLimitHours + 6)}>submit-hours</button>
    );
    const PriceValue: typeof DEPENDENCIES.PriceValue = ({ value }) => <span data-testid="current-balance">{value}</span>;

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: input.state ?? "active",
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [{ denom: "uakt", amount: "1000000" }] })
      })
    });
    const leases = input.leases !== undefined ? input.leases : [mock<LeaseDto>({ id: "1", state: "active" })];

    render(
      <DeploymentBillingSection
        deployment={deployment}
        leases={leases}
        onFundsChanged={onFundsChanged}
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useWallet,
          usePricing,
          usePopup,
          useAutoTopUp,
          useDeploymentEscrowBalance,
          useUpdateDeploymentSettingMutation,
          useTickingNow,
          useSnackbar,
          Snackbar,
          DeploymentDepositModal,
          AddRuntimeHoursModal,
          PriceValue
        })}
      />
    );

    return { setEnabled, deposit, onFundsChanged, mutateAsync, enqueueSnackbar, analyticsService, confirm };
  }
});
