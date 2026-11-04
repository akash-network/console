import type { ReactElement } from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { OptionsObject } from "notistack";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { CustomUserProfile } from "@src/types/user";
import type { DEPENDENCIES } from "./useGithubStarPrompt";
import { CONSOLE_REPOSITORY_URL, useGithubStarPrompt } from "./useGithubStarPrompt";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useGithubStarPrompt.name, () => {
  it("shows a lasting toast that links to the Console repository when the user has never answered", () => {
    const { result, enqueueSnackbar, analyticsService } = setup({ user: { githubStarPromptedAt: null } });

    act(() => result.current());

    const [message, options] = enqueueSnackbar.mock.calls[0] as [ReactElement, OptionsObject];
    render(message);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(options).toMatchObject({ key: "github-star-prompt", preventDuplicate: true, persist: true });
    expect(screen.getByRole("heading", { name: "Your deployment is live" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Star on GitHub/ })).toHaveAttribute("href", CONSOLE_REPOSITORY_URL);
    expect(screen.getByRole("link", { name: /Star on GitHub/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /Star on GitHub/ })).toHaveAttribute("rel", "noopener noreferrer");
    expect(analyticsService.track).toHaveBeenCalledWith("github_star_prompt_shown", { category: "user" });
  });

  it.each([
    { case: "the user already answered", user: { githubStarPromptedAt: "2026-11-04T00:00:00.000Z" } },
    { case: "the profile loaded without the timestamp", user: {} },
    { case: "there is no user", user: undefined }
  ])("shows nothing when $case", ({ user }) => {
    const { result, enqueueSnackbar, analyticsService } = setup({ user });

    act(() => result.current());

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("closes the toast and records the answer once the user stars the repository", async () => {
    const { result, enqueueSnackbar, closeSnackbar, analyticsService, markGithubStarPrompted, checkSession } = setup({ user: { githubStarPromptedAt: null } });
    act(() => result.current());
    const [message, options] = enqueueSnackbar.mock.calls[0] as [ReactElement, OptionsObject];
    render(message);

    await userEvent.click(screen.getByRole("link", { name: /Star on GitHub/ }));
    act(() => options.onClose?.(null, "instructed", "github-star-prompt"));

    expect(analyticsService.track).toHaveBeenCalledWith("github_star_prompt_clicked", { category: "user" });
    expect(analyticsService.track).not.toHaveBeenCalledWith("github_star_prompt_dismissed", expect.anything());
    expect(closeSnackbar).toHaveBeenCalledWith("github-star-prompt");
    await waitFor(() => expect(checkSession).toHaveBeenCalledTimes(1));
    expect(markGithubStarPrompted).toHaveBeenCalledTimes(1);
  });

  it("records a dismissal when the user closes the toast without starring", async () => {
    const { result, enqueueSnackbar, analyticsService, markGithubStarPrompted, checkSession } = setup({ user: { githubStarPromptedAt: null } });
    act(() => result.current());
    const [, options] = enqueueSnackbar.mock.calls[0] as [ReactElement, OptionsObject];

    act(() => options.onClose?.(null, "instructed", "github-star-prompt"));

    expect(analyticsService.track).toHaveBeenCalledWith("github_star_prompt_dismissed", { category: "user" });
    expect(analyticsService.track).not.toHaveBeenCalledWith("github_star_prompt_clicked", expect.anything());
    await waitFor(() => expect(checkSession).toHaveBeenCalledTimes(1));
    expect(markGithubStarPrompted).toHaveBeenCalledTimes(1);
  });

  it("keeps asking when the toast is pushed out by other toasts rather than closed by the user", () => {
    const { result, enqueueSnackbar, analyticsService, markGithubStarPrompted } = setup({ user: { githubStarPromptedAt: null } });
    act(() => result.current());
    const [, options] = enqueueSnackbar.mock.calls[0] as [ReactElement, OptionsObject];

    act(() => options.onClose?.(null, "maxsnack", "github-star-prompt"));

    expect(markGithubStarPrompted).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalledWith("github_star_prompt_dismissed", expect.anything());
  });

  function setup(input: { user?: CustomUserProfile }) {
    const markGithubStarPrompted = vi.fn().mockResolvedValue(undefined);
    const api = createProxy({ v1: { markGithubStarPrompted } }) as unknown as ApiService;
    const analyticsService = mock<AnalyticsService>();
    const checkSession = vi.fn().mockResolvedValue(undefined);
    const enqueueSnackbar = vi.fn();
    const closeSnackbar = vi.fn();
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.user, checkSession });
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar, closeSnackbar });

    const { result } = setupQuery(() => useGithubStarPrompt({ useUser, useSnackbar }), {
      services: {
        api: () => api,
        analyticsService: () => analyticsService
      }
    });

    return { result, enqueueSnackbar, closeSnackbar, analyticsService, markGithubStarPrompted, checkSession };
  }
});
