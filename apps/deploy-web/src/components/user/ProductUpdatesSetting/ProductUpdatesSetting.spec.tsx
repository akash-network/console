import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserSettingsUpdate } from "@src/queries/useSaveSettings";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, ProductUpdatesSetting } from "./ProductUpdatesSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ProductUpdatesSetting.name, () => {
  it("shows product updates as on when the user has not opted out", () => {
    setup({ productUpdatesUnsubscribedAt: null });

    expect(screen.getByRole("switch", { name: "Product updates" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Product updates" })).toBeEnabled();
  });

  it("shows product updates as off when the user has opted out", () => {
    setup({ productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z" });

    expect(screen.getByRole("switch", { name: "Product updates" })).not.toBeChecked();
  });

  it("names the address the emails go to", () => {
    setup({ email: "alice@example.com" });

    expect(screen.getByText("News about new features and changes to Akash Console, sent to alice@example.com.")).toBeInTheDocument();
  });

  it("leaves the address out when the profile has none", () => {
    setup({ email: null });

    expect(screen.getByText("News about new features and changes to Akash Console.")).toBeInTheDocument();
  });

  it("unsubscribes right away and confirms it", async () => {
    const { user, saveSettings, enqueueSnackbar, analyticsService } = setup({ productUpdatesUnsubscribedAt: null });

    await user.click(screen.getByRole("switch", { name: "Product updates" }));

    expect(saveSettings).toHaveBeenCalledWith({ username: "alice", subscribedToProductUpdates: false }, expect.anything());
    expect(analyticsService.track).toHaveBeenCalledWith("user_settings_save", { category: "settings", label: "Change product update emails" });
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    finishSave(saveSettings);

    expect(enqueueSnackbar.mock.lastCall?.[0].props.title).toBe("Unsubscribed from product update emails");
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("subscribes right away and confirms it", async () => {
    const { user, saveSettings, enqueueSnackbar } = setup({ productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z" });

    await user.click(screen.getByRole("switch", { name: "Product updates" }));

    expect(saveSettings).toHaveBeenCalledWith({ username: "alice", subscribedToProductUpdates: true }, expect.anything());

    finishSave(saveSettings);

    expect(enqueueSnackbar.mock.lastCall?.[0].props.title).toBe("Subscribed to product update emails");
  });

  it("shows the requested choice and locks the switch while it saves", () => {
    setup({ productUpdatesUnsubscribedAt: null, pendingChange: { username: "alice", subscribedToProductUpdates: false } });

    expect(screen.getByRole("switch", { name: "Product updates" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Product updates" })).toBeDisabled();
  });

  it("follows an opt-out made elsewhere once the profile refreshes", () => {
    const { refreshUser } = setup({ productUpdatesUnsubscribedAt: null });

    refreshUser({ productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z" });

    expect(screen.getByRole("switch", { name: "Product updates" })).not.toBeChecked();
  });

  function finishSave(saveSettings: ReturnType<typeof setup>["saveSettings"]) {
    const [variables, options] = saveSettings.mock.lastCall ?? [];
    options?.onSuccess?.(undefined as never, variables as UserSettingsUpdate, undefined);
  }

  function setup(input: { productUpdatesUnsubscribedAt?: string | null; email?: string | null; pendingChange?: UserSettingsUpdate }) {
    const analyticsService = mock<AnalyticsService>();
    const saveSettings = vi.fn<ReturnType<typeof DEPENDENCIES.useSaveSettings>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useSaveSettings: () =>
        mock<ReturnType<typeof DEPENDENCIES.useSaveSettings>>({ mutate: saveSettings, isPending: !!input.pendingChange, variables: input.pendingChange }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    });
    const profile = {
      username: "alice",
      email: "email" in input ? input.email : "alice@example.com",
      productUpdatesUnsubscribedAt: input.productUpdatesUnsubscribedAt ?? null
    };
    const renderSetting = (user: typeof profile) => (
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <ProductUpdatesSetting user={user} dependencies={dependencies} />
      </TestContainerProvider>
    );

    const { rerender } = render(renderSetting(profile));

    return {
      user: userEvent.setup(),
      saveSettings,
      enqueueSnackbar,
      analyticsService,
      refreshUser: (changes: Partial<typeof profile>) => rerender(renderSetting({ ...profile, ...changes }))
    };
  }
});
