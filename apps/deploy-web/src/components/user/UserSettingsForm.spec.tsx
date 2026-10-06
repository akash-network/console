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
  it("saves the newsletter preference when the profile has no bio or social links", async () => {
    const { saveSettings } = setup({
      user: { bio: null, youtubeUsername: null, twitterUsername: null, githubUsername: null }
    });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        username: "alice",
        subscribedToNewsletter: true,
        bio: "",
        youtubeUsername: "",
        twitterUsername: "",
        githubUsername: ""
      })
    );
    expect(screen.queryByText("Expected string, received null")).not.toBeInTheDocument();
  });

  it("keeps the saved bio and social links when saving the newsletter preference", async () => {
    const { saveSettings } = setup({
      user: { bio: "Builds on Akash", youtubeUsername: "alice-yt", twitterUsername: "alice-x", githubUsername: "alice-gh" }
    });

    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        username: "alice",
        subscribedToNewsletter: true,
        bio: "Builds on Akash",
        youtubeUsername: "alice-yt",
        twitterUsername: "alice-x",
        githubUsername: "alice-gh"
      })
    );
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
    const user = buildUser({ username: "alice", subscribedToNewsletter: false, ...input.user });
    const saveSettings = vi.fn();
    const useSaveSettings: typeof DEPENDENCIES.useSaveSettings = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSaveSettings>>({ mutate: saveSettings, isPending: false });
    const useCustomUser: typeof DEPENDENCIES.useCustomUser = () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ isLoading: false });

    render(
      <TestContainerProvider
        services={{
          consoleApiHttpClient: () => mock<HttpClient>(),
          analyticsService: () => mock<AnalyticsService>()
        }}
      >
        <UserSettingsForm user={user} dependencies={MockComponents(DEPENDENCIES, { useSaveSettings, useCustomUser })} />
      </TestContainerProvider>
    );

    return { saveSettings };
  }
});
