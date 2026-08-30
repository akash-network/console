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

  it("shows the funding impact for the reviewed rows and the effective runtime limit", () => {
    setup({ runtimeLimitHours: 12 });
    expect(screen.getByTestId("funding-impact-section")).toHaveTextContent("1 rows · limit 12");
  });

  it("shows the funding impact without a limit when runtime limits are not offered", () => {
    setup({ runtimeLimitHours: 12, isRuntimeLimitEnabled: false });
    expect(screen.getByTestId("funding-impact-section")).toHaveTextContent("1 rows · no limit");
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

    it("does not patch when the stored limit already matches the requested one", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, runtimeLimitHours: 12, storedRuntimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("removes the stored limit when confirming with the limit turned off", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, runtimeLimitHours: undefined, storedRuntimeLimitHours: 12 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync.mock.calls).toEqual([[{ runtimeLimitHours: null }]]);
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    });

    it("removes the stored limit before writing a lower one, on a fresh mount that never wrote it", async () => {
      const { mutateAsync } = setup({ runtimeLimitHours: 24, storedRuntimeLimitHours: 48 });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync.mock.calls).toEqual([[{ runtimeLimitHours: null }], [{ runtimeLimitHours: 24 }]]);
    });

    it("waits for the stored limit to be read before allowing a deploy", () => {
      setup({ runtimeLimitHours: 24, isStoredSettingLoading: true });

      expect(screen.getByRole("button", { name: /confirm and deploy/i })).toBeDisabled();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("clears the stored limit first when it could not be read", async () => {
      const { mutateAsync } = setup({ runtimeLimitHours: 24, storedSettingError: new Error("offline") });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync.mock.calls).toEqual([[{ runtimeLimitHours: null }], [{ runtimeLimitHours: 24 }]]);
    });

    it("leaves a stored limit alone when the feature flag is off", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, storedRuntimeLimitHours: 48, isRuntimeLimitEnabled: false });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("deploys when the stored limit cannot be read and the feature is off", async () => {
      const onConfirm = vi.fn();
      const { mutateAsync } = setup({ onConfirm, isRuntimeLimitEnabled: false, storedSettingError: new Error("offline") });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });

    it("says the limit was removed but not replaced when only the second patch fails", async () => {
      const onConfirm = vi.fn();
      const { enqueueSnackbar } = setup({ onConfirm, runtimeLimitHours: 24, storedRuntimeLimitHours: 48, secondPatchError: new Error("offline") });

      await userEvent.click(screen.getByRole("button", { name: /confirm and deploy/i }));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      const [[snackbar]] = enqueueSnackbar.mock.calls;
      render(snackbar);
      expect(screen.getByText("Runtime limit removed but not replaced")).toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
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
    storedRuntimeLimitHours?: number;
    isStoredSettingLoading?: boolean;
    storedSettingError?: Error;
    isRuntimeLimitEnabled?: boolean;
    isRestricted?: boolean;
    isPatchPending?: boolean;
    patchError?: Error;
    secondPatchError?: Error;
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
    const FundingImpactReviewSection: typeof DEPENDENCIES.FundingImpactReviewSection = ({ rows: fundingRows, runtimeLimitHours }) => (
      <div data-testid="funding-impact-section">
        {fundingRows.length} rows · {runtimeLimitHours === undefined ? "no limit" : `limit ${runtimeLimitHours}`}
      </div>
    );
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isRuntimeLimitEnabled ?? true;
    const useTrialGate: typeof DEPENDENCIES.useTrialGate = () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true });

    let patchCalls = 0;
    const mutateAsync = vi.fn().mockImplementation(() => {
      patchCalls++;
      if (input.patchError) return Promise.reject(input.patchError);
      if (input.secondPatchError && patchCalls === 2) return Promise.reject(input.secondPatchError);
      return Promise.resolve();
    });
    const mutation = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>(), {
      mutateAsync,
      isPending: input.isPatchPending ?? false
    });
    const useUpdateDeploymentSettingMutation: typeof DEPENDENCIES.useUpdateDeploymentSettingMutation = () => mutation;

    type StoredSetting = ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>;
    const storedSetting = Object.assign(mock<StoredSetting>(), {
      data:
        input.isStoredSettingLoading || input.storedSettingError
          ? undefined
          : Object.assign(mock<NonNullable<StoredSetting["data"]>>(), { runtimeLimitHours: input.storedRuntimeLimitHours ?? null }),
      isFetching: input.isStoredSettingLoading ?? false,
      error: input.storedSettingError ?? null
    });
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () => storedSetting;

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
          FundingImpactReviewSection,
          RuntimeLimitReviewSection,
          useFlag,
          useTrialGate,
          useDeploymentSettingQuery,
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
