import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, UserSettingsForm } from "./UserSettingsForm";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildUser } from "@tests/seeders/user";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(UserSettingsForm.name, () => {
  it("saves settings when the profile has no bio or social links", async () => {
    const { saveSettings } = setup({
      user: { bio: null, youtubeUsername: null, twitterUsername: null, githubUsername: null, productUpdatesUnsubscribedAt: null }
    });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        username: "alice",
        subscribedToProductUpdates: false,
        bio: "",
        youtubeUsername: "",
        twitterUsername: "",
        githubUsername: ""
      })
    );
    expect(screen.queryByText("Expected string, received null")).not.toBeInTheDocument();
  });

  it("keeps the saved bio and social links when opting back in to product update emails", async () => {
    const { saveSettings } = setup({
      user: {
        bio: "Builds on Akash",
        youtubeUsername: "alice-yt",
        twitterUsername: "alice-x",
        githubUsername: "alice-gh",
        productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z"
      }
    });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        username: "alice",
        subscribedToProductUpdates: true,
        bio: "Builds on Akash",
        youtubeUsername: "alice-yt",
        twitterUsername: "alice-x",
        githubUsername: "alice-gh"
      })
    );
  });

  it("leaves the product update emails choice out when saving other settings", async () => {
    const { saveSettings } = setup({
      user: { bio: "Builds on Akash", youtubeUsername: "alice-yt", twitterUsername: "alice-x", githubUsername: null, productUpdatesUnsubscribedAt: null }
    });

    await userEvent.type(screen.getByPlaceholderText("https://github.com/"), "alice-gh");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        username: "alice",
        bio: "Builds on Akash",
        youtubeUsername: "alice-yt",
        twitterUsername: "alice-x",
        githubUsername: "alice-gh"
      })
    );
    expect(saveSettings.mock.calls[0][0]).not.toHaveProperty("subscribedToProductUpdates");
  });

  it("shows product update emails as on when the user has not opted out", () => {
    setup({ user: { productUpdatesUnsubscribedAt: null } });

    expect(screen.getByText("Product update emails")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("shows product update emails as off when the user has opted out", () => {
    setup({ user: { productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z" } });

    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("follows an opt-out made elsewhere once the profile refreshes", () => {
    const { refreshUser } = setup({ user: { productUpdatesUnsubscribedAt: null } });

    refreshUser({ productUpdatesUnsubscribedAt: "2026-10-05T18:31:47.000Z" });

    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("asks for a username when the profile has none", async () => {
    setup({ user: { username: undefined } });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username must be at least 3 characters long");
  });

  it("keeps Save disabled when a change is undone", async () => {
    setup({ user: {} });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("switch"));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  function setup(input: { user: Partial<CustomUserProfile> }) {
    const user = buildUser({ username: "alice", ...input.user });
    const saveSettings = vi.fn();
    const useSaveSettings: typeof DEPENDENCIES.useSaveSettings = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSaveSettings>>({ mutate: saveSettings, isPending: false });
    const useCustomUser: typeof DEPENDENCIES.useCustomUser = () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ isLoading: false });
    const dependencies = MockComponents(DEPENDENCIES, { useSaveSettings, useCustomUser });
    const services = {
      consoleApiHttpClient: () => mock<HttpClient>(),
      analyticsService: () => mock<AnalyticsService>()
    };
    const renderForm = (profile: CustomUserProfile) => (
      <TestContainerProvider services={services}>
        <UserSettingsForm user={profile} dependencies={dependencies} />
      </TestContainerProvider>
    );

    const { rerender } = render(renderForm(user));

    return {
      saveSettings,
      refreshUser: (changes: Partial<CustomUserProfile>) => rerender(renderForm({ ...user, ...changes }))
    };
  }
});
