import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { DEPENDENCIES } from "./ReviewAndDeployModal";
import { ReviewAndDeployModal } from "./ReviewAndDeployModal";
import type { ReviewRow } from "./useReviewRows";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ReviewAndDeployModal.name, () => {
  it("lists one row per selected placement with provider and price", () => {
    setup({
      rows: [{ placementId: "p1", placementName: "placement-1", region: "Any region", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } }]
    });
    expect(screen.getByText("placement-1 · Any region")).toBeInTheDocument();
    expect(screen.getByText("Dune Networks")).toBeInTheDocument();
    expect(screen.getAllByTestId("price")).toHaveLength(2);
  });

  it("prices per placement and total by the hour when the deployment uses a GPU", () => {
    setup({ hasGpu: true });
    screen.getAllByTestId("price").forEach(price => expect(price).toHaveTextContent("hourly"));
  });

  it("prices per placement and total by the month for a CPU-only deployment", () => {
    setup({ hasGpu: false });
    screen.getAllByTestId("price").forEach(price => expect(price).toHaveTextContent("monthly"));
  });

  it("confirms with onConfirm", async () => {
    const onConfirm = vi.fn();
    setup({ onConfirm });
    await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("goes back with onBack", async () => {
    const onBack = vi.fn();
    setup({ onBack });
    await userEvent.click(screen.getByRole("button", { name: /back to marketplace/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("disables Confirm and deploy when a selected placement is no longer priced", () => {
    setup({
      rows: [
        { placementId: "p1", placementName: "placement-1", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } },
        { placementId: "p2", placementName: "placement-2", providerName: "Polaris", price: undefined }
      ],
      pricedCount: 1,
      totalCount: 2
    });
    expect(screen.getByRole("button", { name: /confirm and deploy/i })).toBeDisabled();
  });

  describe("runtime limit", () => {
    it("offers the runtime limit section by default", () => {
      setup({});
      expect(screen.getByTestId("runtime-limit-section")).toBeInTheDocument();
    });

    it("hides the runtime limit section when the feature flag is off", () => {
      setup({ isRuntimeLimitEnabled: false });
      expect(screen.queryByTestId("runtime-limit-section")).not.toBeInTheDocument();
    });

    it("hides the runtime limit section for a trial user", () => {
      setup({ isRestricted: true });
      expect(screen.queryByTestId("runtime-limit-section")).not.toBeInTheDocument();
    });

    it("deploys without patching settings when no limit was chosen", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("patches the runtime limit before deploying", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).toHaveBeenCalledWith({ runtimeLimitHours: 12 });
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    });

    it("surfaces a failed patch and does not deploy", async () => {
      const onConfirm = vi.fn();
      const { enqueueSnackbar } = setup({ onConfirm, runtimeLimitHours: 12, patchError: new Error("nope") });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("does not patch a leftover limit when the feature flag is off", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, runtimeLimitHours: 12, isRuntimeLimitEnabled: false });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("does not patch a leftover limit for a trial user", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, runtimeLimitHours: 12, isRestricted: true });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("blocks both actions while the patch is in flight", () => {
      setup({ runtimeLimitHours: 12, isPatchPending: true });

      expect(screen.getByRole("button", { name: /confirm and deploy/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /back to marketplace/i })).toBeDisabled();
    });

    it("does not patch again when a retry confirms the limit it already committed", async () => {
      const { mutateAsync } = setup({ runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
      mutateAsync.mockClear();
      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("removes a committed limit when a retry confirms with the limit turned off", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync, setRuntimeLimitHours } = setup({ onConfirm, runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
      await userEvent.click(screen.getByRole("button", { name: /turn off runtime limit/i }));
      setRuntimeLimitHours(undefined);
      mutateAsync.mockClear();
      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).toHaveBeenCalledWith({ runtimeLimitHours: null });
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    });

    it("removes a committed limit before writing a lower one on a retry", async () => {
      const { mutateAsync, setRuntimeLimitHours } = setup({ runtimeLimitHours: 24 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
      setRuntimeLimitHours(6);
      mutateAsync.mockClear();
      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync.mock.calls).toEqual([[{ runtimeLimitHours: null }], [{ runtimeLimitHours: 6 }]]);
    });

    it("blocks deploying while the limit is switched on with no hours entered", async () => {
      setup({});

      await userEvent.click(screen.getByRole("button", { name: /turn on runtime limit/i }));

      expect(screen.getByRole("button", { name: /confirm and deploy/i })).toBeDisabled();
    });

    it("raises a committed limit directly on a retry", async () => {
      const { mutateAsync, setRuntimeLimitHours } = setup({ runtimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));
      setRuntimeLimitHours(24);
      mutateAsync.mockClear();
      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync.mock.calls).toEqual([[{ runtimeLimitHours: 24 }]]);
    });
  });

  function setup(input: {
    rows?: ReviewRow[];
    pricedCount?: number;
    totalCount?: number;
    hasGpu?: boolean;
    onConfirm?: () => void;
    onBack?: () => void;
    runtimeLimitHours?: number;
    isRuntimeLimitEnabled?: boolean;
    isRestricted?: boolean;
    isPatchPending?: boolean;
    patchError?: Error;
  }) {
    const rows = input.rows ?? [
      { placementId: "p1", placementName: "placement-1", region: "Any region", providerName: "Dune Networks", price: { amount: "100", denom: "uakt" } }
    ];
    const useReviewRows: typeof DEPENDENCIES.useReviewRows = () => ({
      rows,
      pricedCount: input.pricedCount ?? rows.filter(row => row.price).length,
      totalCount: input.totalCount ?? rows.length
    });
    const PricePerTimeUnit: typeof DEPENDENCIES.PricePerTimeUnit = ({ showAsHourly }) => <span data-testid="price">{showAsHourly ? "hourly" : "monthly"}</span>;
    const useDeploymentHasGpu: typeof DEPENDENCIES.useDeploymentHasGpu = () => input.hasGpu ?? false;
    const RuntimeLimitReviewSection: typeof DEPENDENCIES.RuntimeLimitReviewSection = ({ isLimited, onLimitedChange, onChange }) => (
      <button
        data-testid="runtime-limit-section"
        onClick={() => {
          onLimitedChange(!isLimited);
          onChange(isLimited ? undefined : 24);
        }}
      >
        {isLimited ? "Turn off runtime limit" : "Turn on runtime limit"}
      </button>
    );
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isRuntimeLimitEnabled ?? true;
    const useTrialGate: typeof DEPENDENCIES.useTrialGate = () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true });

    const mutateAsync = vi.fn().mockImplementation(() => (input.patchError ? Promise.reject(input.patchError) : Promise.resolve()));
    const mutation = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>(), {
      mutateAsync,
      isPending: input.isPatchPending ?? false
    });
    const useUpdateDeploymentSettingMutation: typeof DEPENDENCIES.useUpdateDeploymentSettingMutation = () => mutation;

    const enqueueSnackbar = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const Snackbar: typeof DEPENDENCIES.Snackbar = ({ title }) => <span>{title}</span>;

    const modal = (runtimeLimitHours: number | undefined) => (
      <ReviewAndDeployModal
        open
        dseq="55"
        placements={[mock<PlacementType>({ id: "p1", name: "placement-1", region: "Any region" })]}
        selections={{ p1: "akash1a/55/1/2" }}
        runtimeLimitHours={runtimeLimitHours}
        onRuntimeLimitHoursChange={vi.fn()}
        onConfirm={input.onConfirm ?? vi.fn()}
        onBack={input.onBack ?? vi.fn()}
        dependencies={{
          useReviewRows,
          PricePerTimeUnit,
          useDeploymentHasGpu,
          RuntimeLimitReviewSection,
          useFlag,
          useTrialGate,
          useUpdateDeploymentSettingMutation,
          useSnackbar,
          Snackbar
        }}
      />
    );

    const { rerender } = render(modal(input.runtimeLimitHours));
    const setRuntimeLimitHours = (runtimeLimitHours: number | undefined) => rerender(modal(runtimeLimitHours));

    return { mutateAsync, enqueueSnackbar, setRuntimeLimitHours };
  }
});
