import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentBillingSection } from "./DeploymentBillingSection";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentBillingSection.name, () => {
  it("does not offer a switch to always on when the deployment has no runtime limit", () => {
    setup({ state: "active" });

    expect(screen.queryByRole("button", { name: "Switch to always on" })).not.toBeInTheDocument();
  });

  describe("when the deployment has a runtime limit", () => {
    it("offers Add hours", () => {
      setup({ state: "active", runtimeLimitHours: 12 });

      expect(screen.getByRole("button", { name: "Add hours" })).toBeInTheDocument();
    });

    it("hides Add hours and the always-on switch once the deployment is closed", () => {
      setup({ state: "closed", runtimeLimitHours: 12 });

      expect(screen.queryByRole("button", { name: "Add hours" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Switch to always on" })).not.toBeInTheDocument();
    });

    it("shows the limit alone, with no meter, before the countdown is anchored to a lease", () => {
      setup({ state: "active", runtimeLimitHours: 12, runtimeEndsAt: null });

      expect(screen.getByText("12h")).toBeInTheDocument();
      expect(screen.getByText("runtime limit")).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("meters the remaining time against the limit once the countdown is anchored", () => {
      setup({ state: "active", runtimeLimitHours: 1, runtimeEndsAt: "2026-08-21T12:36:00.000Z" });

      expect(screen.getByText("36m left")).toBeInTheDocument();
      expect(screen.getByText("of 1h limit")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    });

    it("reads as ended, with no meter, once the deployment is closed with time still on its limit", () => {
      setup({ state: "closed", runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T18:00:00.000Z" });

      expect(screen.getByText("Runtime ended")).toBeInTheDocument();
      expect(screen.getByText("of 12h limit")).toBeInTheDocument();
      expect(screen.queryByText("6h left")).not.toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("keeps counting down while the lease list is still loading, so an active deployment never flashes as ended", () => {
      setup({ state: "active", runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T18:00:00.000Z", leases: null });

      expect(screen.getByText("6h left")).toBeInTheDocument();
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

    it("removes the limit once the switch is confirmed", async () => {
      const { mutateAsync, onFundsChanged } = setup({ state: "active", runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: "Switch to always on" }));

      expect(mutateAsync).toHaveBeenCalledWith({ runtimeLimitHours: null });
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

  function setup(input: {
    state?: string;
    leases?: LeaseDto[] | null;
    runtimeLimitHours?: number;
    runtimeEndsAt?: string | null;
    patchError?: Error;
    isConfirmed?: boolean;
  }) {
    const onFundsChanged = vi.fn();

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });

    const deploymentSettingQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>>(), {
      data: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>["data"]>>({
        runtimeLimitHours: input.runtimeLimitHours ?? null,
        runtimeEndsAt: input.runtimeEndsAt ?? null
      }),
      isLoading: false
    });
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () => deploymentSettingQuery;

    const useDeploymentMetrics: typeof DEPENDENCIES.useDeploymentMetrics = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentMetrics>>({ deploymentCost: 100 });

    const useTickingNow: typeof DEPENDENCIES.useTickingNow = () => Date.parse("2026-08-21T12:00:00.000Z");

    const mutateAsync = vi.fn().mockImplementation(() => (input.patchError ? Promise.reject(input.patchError) : Promise.resolve()));
    const mutation = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>(), { mutateAsync, isPending: false });
    const useUpdateDeploymentSettingMutation: typeof DEPENDENCIES.useUpdateDeploymentSettingMutation = () => mutation;

    const confirm = vi.fn().mockResolvedValue(input.isConfirmed ?? true);
    const usePopup: typeof DEPENDENCIES.usePopup = () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm });

    const enqueueSnackbar = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const Snackbar: typeof DEPENDENCIES.Snackbar = ({ title }) => <span>{title}</span>;

    const AddRuntimeHoursModal: typeof DEPENDENCIES.AddRuntimeHoursModal = ({ currentLimitHours, onSubmit }) => (
      <button onClick={() => onSubmit(currentLimitHours + 6)}>submit-hours</button>
    );

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
          usePopup,
          useDeploymentSettingQuery,
          useDeploymentMetrics,
          useUpdateDeploymentSettingMutation,
          useTickingNow,
          useSnackbar,
          Snackbar,
          AddRuntimeHoursModal
        })}
      />
    );

    return { onFundsChanged, mutateAsync, enqueueSnackbar, analyticsService, confirm };
  }
});
