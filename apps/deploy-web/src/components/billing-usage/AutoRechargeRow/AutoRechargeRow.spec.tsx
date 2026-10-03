import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import { AutoRechargeRow, DEPENDENCIES } from "./AutoRechargeRow";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type WalletSettings = NonNullable<ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>["data"]>;
type DefaultPaymentMethod = NonNullable<ReturnType<typeof DEPENDENCIES.useDefaultPaymentMethodQuery>["data"]>;
type UpsertWalletSettings = ReturnType<typeof DEPENDENCIES.useWalletSettingsMutations>["upsertWalletSettings"];

describe(AutoRechargeRow.name, () => {
  it("names the feature auto recharge next to its switch", () => {
    setup({ defaultPaymentMethod: card() });

    expect(screen.getByText("Auto Recharge")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto recharge" })).not.toBeChecked();
  });

  it("says recharges are manual while it is off", () => {
    setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: false } });

    expect(summary()).toHaveTextContent("Off · top up manually");
    expect(screen.queryByRole("button", { name: "Edit auto recharge settings" })).not.toBeInTheDocument();
  });

  it("states the fixed rule once it is on", () => {
    setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 30, autoReloadAmount: 150 } });

    expect(screen.getByRole("switch", { name: "Auto recharge" })).toBeChecked();
    expect(summary()).toHaveTextContent(/^Adds 150 when available drops to 30$/);
  });

  it("stays off and opens the settings without stored values before the account has any", () => {
    const { AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: card(), walletSettings: null });

    expect(summary()).toHaveTextContent("Off · top up manually");
    expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ threshold: undefined, amount: undefined }), expect.anything());
  });

  it("estimates when the next recharge lands at the current spend", () => {
    setup({
      defaultPaymentMethod: card(),
      walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
      perHour: 1,
      available: 92
    });

    expect(summary()).toHaveTextContent("Adds 100 when available drops to 20 · next in ~3 days");
  });

  it("keeps the estimate singular for a recharge less than a day out", () => {
    setup({
      defaultPaymentMethod: card(),
      walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
      perHour: 1,
      available: 21
    });

    expect(summary()).toHaveTextContent(/ · next in ~1 day$/);
  });

  it.each([
    { scenario: "nothing is being spent", perHour: 0, available: 500 },
    { scenario: "available is already at the threshold", perHour: 1, available: 20 },
    { scenario: "the balance is still loading", perHour: 1, available: 92, isBalanceLoading: true },
    { scenario: "the balance failed to load", perHour: 1, available: 92, isBalanceError: true }
  ])("leaves the estimate out when $scenario", ({ perHour, available, isBalanceLoading, isBalanceError }) => {
    setup({
      defaultPaymentMethod: card(),
      walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
      perHour,
      available,
      isBalanceLoading,
      isBalanceError
    });

    expect(summary()).not.toHaveTextContent("next in");
  });

  it("states the weekly coverage in prediction mode", () => {
    setup({ autoReloadMode: "prediction", defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true }, weeklyCost: 42 });

    expect(summary()).toHaveTextContent("Covers the next week (~42) of your deployments");
  });

  it("holds the weekly coverage back while the weekly cost loads", () => {
    setup({ autoReloadMode: "prediction", defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true }, isWeeklyCostLoading: true });

    expect(summary()).not.toHaveTextContent("Covers");
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("queries the weekly cost only in prediction mode", () => {
    const threshold = setup({ autoReloadMode: "threshold", defaultPaymentMethod: card() });
    const prediction = setup({ autoReloadMode: "prediction", defaultPaymentMethod: card() });

    expect(threshold.dependencies.useWeeklyDeploymentCostQuery).toHaveBeenCalledWith({ enabled: false });
    expect(prediction.dependencies.useWeeklyDeploymentCostQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("passes the stored mode and values to the settings dialog", () => {
    const { AutoRechargeSettingsPopup } = setup({
      autoReloadMode: "prediction",
      defaultPaymentMethod: card(),
      walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 30, autoReloadAmount: 150 }
    });

    expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "prediction", threshold: 30, amount: 150, open: false }),
      expect.anything()
    );
  });

  it("opens the settings first when switched on, without saving anything", () => {
    const { AutoRechargeSettingsPopup, upsertMutate } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: false } });

    fireEvent.click(screen.getByRole("switch", { name: "Auto recharge" }));

    expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("asks for confirmation before turning it off", async () => {
    const { confirm, upsertMutate } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true } });

    await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Auto recharge" })));

    expect(confirm).toHaveBeenCalledWith({
      title: "Turn off auto recharge?",
      message: "Your deployments may stop if your credit balance runs out, and no automatic charges will be made."
    });
    expect(upsertMutate).toHaveBeenCalledWith({ data: { autoReloadEnabled: false } }, expect.anything());
  });

  it("stays on when the confirmation is cancelled", async () => {
    const { upsertMutate } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true }, confirmResult: false });

    await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Auto recharge" })));

    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it.each([
    { outcome: "onSuccess", variant: "success" },
    { outcome: "onError", variant: "error" }
  ])("reports the turn-off result with a $variant snackbar", async ({ outcome, variant }) => {
    const upsertMutate = vi.fn((_payload, options) => options?.[outcome]?.());
    const { enqueueSnackbar } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true }, upsertMutate });

    await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Auto recharge" })));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant }));
  });

  it("opens the settings for editing from Edit", () => {
    const { AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true } });

    fireEvent.click(screen.getByRole("button", { name: "Edit auto recharge settings" }));

    expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: false }), expect.anything());
  });

  it("closes the settings when the dialog asks to", () => {
    const { AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true } });

    fireEvent.click(screen.getByRole("button", { name: "Edit auto recharge settings" }));
    act(() => AutoRechargeSettingsPopup.mock.lastCall![0].onClose());

    expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
  });

  it("locks the switch and Edit while a change is saving", () => {
    setup({ defaultPaymentMethod: card(), walletSettings: { autoReloadEnabled: true }, isPending: true });

    expect(screen.getByRole("switch", { name: "Auto recharge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit auto recharge settings" })).toBeDisabled();
  });

  describe("without a card on file", () => {
    it("locks the switch and asks for a card", () => {
      setup({ defaultPaymentMethod: undefined });

      expect(screen.getByRole("switch", { name: "Auto recharge" })).toBeDisabled();
      expect(summary()).toHaveTextContent("Add a card to turn on auto recharge");
      expect(screen.queryByRole("button", { name: "Edit auto recharge settings" })).not.toBeInTheDocument();
    });

    it("opens the add card flow from the prompt", () => {
      const { openAddPaymentMethod } = setup({ defaultPaymentMethod: undefined });

      fireEvent.click(screen.getByRole("button", { name: "Add a card" }));

      expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it("shows a skeleton instead of the prompt while the card loads", () => {
      setup({ defaultPaymentMethod: undefined, isDefaultPaymentMethodLoading: true });

      expect(screen.queryByRole("button", { name: "Add a card" })).not.toBeInTheDocument();
      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });

    it("shows a skeleton while the settings load", () => {
      setup({ defaultPaymentMethod: card(), isWalletSettingsLoading: true });

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Auto recharge" })).toBeDisabled();
    });
  });

  describe("when paused after repeated card declines", () => {
    it("names the declined card instead of the rule", () => {
      setup({
        defaultPaymentMethod: card({ brand: "visa", last4: "4242" }),
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100, autoReloadPausedAt: "2026-09-30T00:00:00Z" }
      });

      expect(summary()).toHaveTextContent("Paused · Visa **** 4242 was declined several times. Update card");
      expect(summary()).not.toHaveTextContent("Adds");
      expect(screen.queryByRole("button", { name: "Edit auto recharge settings" })).not.toBeInTheDocument();
    });

    it("falls back to a generic card name when the default method is not a card", () => {
      setup({ defaultPaymentMethod: { id: "pm_link", type: "link" }, walletSettings: pausedSettings() });

      expect(summary()).toHaveTextContent("Your default card was declined several times.");
    });

    it("sends the user to add a card to lift the pause", () => {
      const { openAddPaymentMethod } = setup({ defaultPaymentMethod: card(), walletSettings: pausedSettings() });

      fireEvent.click(screen.getByRole("button", { name: "Update card" }));

      expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
    });
  });

  describe("when arriving from the deploy flow's setup link", () => {
    it("opens the add card flow and clears the param when no card is on file", () => {
      const { openAddPaymentMethod, replace, AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: undefined, hasSetupParam: true });

      expect(openAddPaymentMethod).toHaveBeenCalledWith(expect.objectContaining({ onSuccess: expect.any(Function) }));
      expect(replace).toHaveBeenCalledWith("/billing", { scroll: false });
      expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
    });

    it("opens the settings straight away when a card is on file", () => {
      const { openAddPaymentMethod, AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: card(), hasSetupParam: true });

      expect(openAddPaymentMethod).not.toHaveBeenCalled();
      expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
    });

    it("opens the settings once the new card is added", () => {
      const { openAddPaymentMethod, AutoRechargeSettingsPopup } = setup({ defaultPaymentMethod: undefined, hasSetupParam: true });

      act(() => openAddPaymentMethod.mock.calls[0][0].onSuccess());

      expect(AutoRechargeSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
    });

    it("does nothing without the param", () => {
      const { openAddPaymentMethod, replace } = setup({ defaultPaymentMethod: card() });

      expect(openAddPaymentMethod).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it("waits for the card query before acting on the param", () => {
      const { openAddPaymentMethod, replace } = setup({ defaultPaymentMethod: undefined, isDefaultPaymentMethodLoading: true, hasSetupParam: true });

      expect(openAddPaymentMethod).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  function card(input: { brand?: string; last4?: string } = {}): DefaultPaymentMethod {
    return { id: "pm_123", type: "card", card: { brand: input.brand ?? "visa", last4: input.last4 ?? "4242", exp_month: 12, exp_year: 2030 } };
  }

  function pausedSettings(): Partial<WalletSettings> {
    return { autoReloadEnabled: true, autoReloadPausedAt: "2026-09-30T00:00:00Z" };
  }

  function summary() {
    return screen.getByTestId("auto-recharge-summary");
  }

  function setup(input: {
    autoReloadMode?: "prediction" | "threshold";
    defaultPaymentMethod?: DefaultPaymentMethod;
    isDefaultPaymentMethodLoading?: boolean;
    walletSettings?: Partial<WalletSettings> | null;
    isWalletSettingsLoading?: boolean;
    weeklyCost?: number;
    isWeeklyCostLoading?: boolean;
    confirmResult?: boolean;
    upsertMutate?: UpsertWalletSettings["mutate"];
    isPending?: boolean;
    perHour?: number;
    available?: number;
    isBalanceLoading?: boolean;
    isBalanceError?: boolean;
    hasSetupParam?: boolean;
  }) {
    const upsertMutate = input.upsertMutate ?? vi.fn();
    const enqueueSnackbar = vi.fn();
    const openAddPaymentMethod = vi.fn();
    const replace = vi.fn();
    const confirm = vi.fn().mockResolvedValue(input.confirmResult ?? true);
    const AutoRechargeSettingsPopup = vi.fn<typeof DEPENDENCIES.AutoRechargeSettingsPopup>(ComponentMock);
    const mode = input.autoReloadMode ?? "threshold";
    const searchParams = mock<ReturnType<typeof DEPENDENCIES.useSearchParams>>();
    searchParams.get.mockImplementation(key => (key === "setupAutoTopUp" && input.hasSetupParam ? "true" : null));
    const walletSettings: WalletSettings | null =
      input.walletSettings === null
        ? null
        : {
            autoReloadEnabled: false,
            autoReloadMode: mode,
            autoReloadThreshold: 20,
            autoReloadAmount: 100,
            autoReloadPausedAt: null,
            ...input.walletSettings
          };

    const dependencies = MockComponents(DEPENDENCIES, {
      useAutoReloadMode: () => ({ mode, showsThresholdRule: mode === "threshold", isLoading: false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useDefaultPaymentMethodQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDefaultPaymentMethodQuery>>(), {
          data: input.defaultPaymentMethod,
          isLoading: input.isDefaultPaymentMethodLoading ?? false
        }),
      useWalletSettingsQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>>(), {
          data: input.isWalletSettingsLoading ? undefined : walletSettings,
          isLoading: input.isWalletSettingsLoading ?? false
        }),
      useWeeklyDeploymentCostQuery: vi.fn(() =>
        mock<ReturnType<typeof DEPENDENCIES.useWeeklyDeploymentCostQuery>>({ data: input.isWeeklyCostLoading ? undefined : input.weeklyCost ?? 5 })
      ),
      useWalletSettingsMutations: () =>
        mock<ReturnType<typeof DEPENDENCIES.useWalletSettingsMutations>>({
          upsertWalletSettings: mock<UpsertWalletSettings>({ mutate: upsertMutate, isPending: input.isPending ?? false })
        }),
      useAccountBalanceOverview: () =>
        mock<ReturnType<typeof DEPENDENCIES.useAccountBalanceOverview>>({
          perHour: input.perHour ?? 0,
          available: input.available ?? 0,
          isLoading: input.isBalanceLoading ?? false,
          isError: input.isBalanceError ?? false
        }),
      useBillingActions: () => ({ openAddPaymentMethod }),
      useSearchParams: () => searchParams,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ urlService: UrlService }),
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      AutoRechargeSettingsPopup,
      UsdValue: ({ value }) => <>{value}</>,
      Skeleton: () => <span data-testid="skeleton" />,
      Switch: DEPENDENCIES.Switch
    });

    render(<AutoRechargeRow dependencies={dependencies} />);

    return { dependencies, upsertMutate, enqueueSnackbar, openAddPaymentMethod, replace, confirm, AutoRechargeSettingsPopup };
  }
});
