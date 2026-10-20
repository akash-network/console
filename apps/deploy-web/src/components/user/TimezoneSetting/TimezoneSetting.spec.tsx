import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserSettingsUpdate } from "@src/queries/useSaveSettings";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./TimezoneSetting";
import { TimezoneSetting } from "./TimezoneSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(TimezoneSetting.name, () => {
  it("shows the timezone the user's emails use", () => {
    setup({ timezone: "America/New_York" });

    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveTextContent("America/New York");
    expect(screen.getByRole("combobox", { name: "Timezone" })).toBeEnabled();
  });

  it("shows UTC while the user's timezone is unknown", () => {
    setup({ timezone: null });

    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveTextContent("UTC");
  });

  it("explains which emails the timezone applies to", () => {
    setup({ timezone: null });

    expect(
      screen.getByText("Dates and times in your emails are shown in this timezone. Until you pick one, it follows the browser you sign in with.")
    ).toBeInTheDocument();
  });

  it("saves the timezone the user picks and confirms it", async () => {
    const { user, saveSettings, enqueueSnackbar, analyticsService } = setup({ timezone: "America/New_York" });

    await user.click(screen.getByRole("combobox", { name: "Timezone" }));
    await user.type(await screen.findByRole("combobox", { name: "Search timezones" }), "tokyo");
    await user.click(await screen.findByRole("option", { name: "Asia/Tokyo" }));

    expect(saveSettings).toHaveBeenCalledWith({ username: "alice", timezone: "Asia/Tokyo" }, expect.anything());
    expect(analyticsService.track).toHaveBeenCalledWith("user_settings_save", { category: "settings", label: "Change email timezone" });
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    finishSave(saveSettings);

    expect(enqueueSnackbar.mock.lastCall?.[0].props.title).toBe("Timezone updated");
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("finds a zone by its city written with a space", async () => {
    const { user } = setup({ timezone: null });

    await user.click(screen.getByRole("combobox", { name: "Timezone" }));
    await user.type(await screen.findByRole("combobox", { name: "Search timezones" }), "new york");

    expect(await screen.findByRole("option", { name: "America/New York" })).toBeInTheDocument();
  });

  it("shows the picked timezone and locks the picker while it saves", () => {
    setup({ timezone: "America/New_York", save: { isPending: true, variables: { username: "alice", timezone: "Asia/Tokyo" } } });

    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveTextContent("Asia/Tokyo");
    expect(screen.getByRole("combobox", { name: "Timezone" })).toBeDisabled();
  });

  it("shows the saved timezone again once a save fails", () => {
    setup({ timezone: "America/New_York", save: { isPending: false, variables: { username: "alice", timezone: "Asia/Tokyo" } } });

    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveTextContent("America/New York");
  });

  it("follows a timezone detected at a later sign-in once the profile refreshes", () => {
    const { refreshUser } = setup({ timezone: "America/New_York" });

    refreshUser({ timezone: "Europe/Paris" });

    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveTextContent("Europe/Paris");
  });

  it("lists a timezone the browser knows under another name once the profile refreshes to it", async () => {
    const { user, refreshUser } = setup({ timezone: "America/New_York" });

    refreshUser({ timezone: "Asia/Kolkata" });
    await user.click(screen.getByRole("combobox", { name: "Timezone" }));

    expect(await screen.findByRole("option", { name: "Asia/Kolkata" })).toBeInTheDocument();
  });

  function finishSave(saveSettings: ReturnType<typeof setup>["saveSettings"]) {
    const [variables, options] = saveSettings.mock.lastCall ?? [];
    options?.onSuccess?.(undefined as never, variables as UserSettingsUpdate, undefined);
  }

  function setup(input: { timezone: string | null; save?: { isPending: boolean; variables: UserSettingsUpdate } }) {
    const analyticsService = mock<AnalyticsService>();
    const saveSettings = vi.fn<ReturnType<typeof DEPENDENCIES.useSaveSettings>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useSaveSettings: () =>
        mock<ReturnType<typeof DEPENDENCIES.useSaveSettings>>({ mutate: saveSettings, isPending: !!input.save?.isPending, variables: input.save?.variables }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };
    const profile = { username: "alice", timezone: input.timezone };
    const renderSetting = (user: typeof profile) => (
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TimezoneSetting user={user} dependencies={dependencies} />
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
