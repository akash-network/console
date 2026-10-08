import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DEPENDENCIES, UsernameSetting } from "./UsernameSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(UsernameSetting.name, () => {
  it("shows the saved username with Save disabled", () => {
    const { useUsernameAvailability } = setup({ username: "alice" });

    expect(screen.getByLabelText("Username")).toHaveValue("alice");
    expect(screen.getByLabelText("Username")).toHaveAttribute("spellcheck", "false");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByText("Username is not available")).not.toBeInTheDocument();
    expect(useUsernameAvailability).toHaveBeenLastCalledWith(undefined);
  });

  it("starts empty when the profile has no username", () => {
    setup({ username: undefined });

    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("checks a changed username that passes validation", async () => {
    const { user, useUsernameAvailability } = setup({ username: "alice" });

    await user.type(screen.getByLabelText("Username"), "-dev");

    expect(useUsernameAvailability).toHaveBeenLastCalledWith("alice-dev");
  });

  it.each([
    { typed: "al", message: "Username must be at least 3 characters long" },
    { typed: "a".repeat(41), message: "Username must be at most 40 characters long" },
    { typed: "alice dev", message: "Username can only contain letters, numbers, dashes and underscores" }
  ])("explains why $typed is rejected and skips the availability check", async ({ typed, message }) => {
    const { user, useUsernameAvailability } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.clear(screen.getByLabelText("Username"));
    await user.type(screen.getByLabelText("Username"), typed);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription(message);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(useUsernameAvailability).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps Save disabled while availability is being checked", async () => {
    const { user } = setup({ username: "alice", availability: { isChecking: true } });

    await user.type(screen.getByLabelText("Username"), "-dev");

    expect(screen.getByText("Checking availability…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps Save disabled when the username is taken", async () => {
    const { user } = setup({ username: "alice", availability: { isAvailable: false } });

    await user.type(screen.getByLabelText("Username"), "-dev");

    expect(screen.getByText("Username is not available")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves an available username and confirms it", async () => {
    const { user, saveSettings, enqueueSnackbar, analyticsService } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.type(screen.getByLabelText("Username"), "-dev");
    expect(screen.getByText("Username is available")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "false");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveSettings).toHaveBeenCalledWith({ username: "alice-dev" }, expect.anything());
    expect(analyticsService.track).toHaveBeenCalledWith("user_settings_save", { category: "settings", label: "Save username" });
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    saveSettings.mock.lastCall?.[1]?.onSuccess?.(undefined as never, { username: "alice-dev" }, undefined);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("saves with Enter", async () => {
    const { user, saveSettings } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.type(screen.getByLabelText("Username"), "-dev{Enter}");

    expect(saveSettings).toHaveBeenCalledWith({ username: "alice-dev" }, expect.anything());
  });

  it("does not save with Enter while the username is unchanged", async () => {
    const { user, saveSettings } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.type(screen.getByLabelText("Username"), "{Enter}");

    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("does not save again while a save is in flight", async () => {
    const { user, saveSettings } = setup({ username: "alice", availability: { isAvailable: true }, isSaving: true });

    await user.type(screen.getByLabelText("Username"), "-dev{Enter}");

    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("restores the saved username with Escape", async () => {
    const { user } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.type(screen.getByLabelText("Username"), "-dev{Escape}");

    expect(screen.getByLabelText("Username")).toHaveValue("alice");
    expect(screen.queryByText("Username is available")).not.toBeInTheDocument();
  });

  it("keeps the typed username on other keys", async () => {
    const { user } = setup({ username: "alice", availability: { isAvailable: true } });

    await user.type(screen.getByLabelText("Username"), "-dev{Tab}");

    expect(screen.getByLabelText("Username")).toHaveValue("alice-dev");
  });

  function setup(input: { username: string | undefined; availability?: { isChecking?: boolean; isAvailable?: boolean }; isSaving?: boolean }) {
    const analyticsService = mock<AnalyticsService>();
    const saveSettings = vi.fn<ReturnType<typeof DEPENDENCIES.useSaveSettings>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const availability = { isChecking: false, isAvailable: undefined, ...input.availability };
    const useUsernameAvailability = vi.fn<typeof DEPENDENCIES.useUsernameAvailability>(username =>
      username ? availability : { isChecking: false, isAvailable: undefined }
    );
    const dependencies = MockComponents(DEPENDENCIES, {
      useSaveSettings: () => mock<ReturnType<typeof DEPENDENCIES.useSaveSettings>>({ mutate: saveSettings, isPending: input.isSaving ?? false }),
      useUsernameAvailability,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <UsernameSetting username={input.username} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), saveSettings, enqueueSnackbar, analyticsService, useUsernameAvailability };
  }
});
