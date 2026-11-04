import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NewApiKey } from "@src/queries/useApiKeysQuery";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./useOnboardingApiKey";
import { ONBOARDING_API_KEY_NAME, useOnboardingApiKey } from "./useOnboardingApiKey";

import { renderHook } from "@testing-library/react";

type MutateOptions = { onSuccess: () => void; onError: () => void };

describe(useOnboardingApiKey.name, () => {
  it("creates the key in the trial's default project", () => {
    const { result, mutate } = setup({ projects: [project({ id: "team-project", isDefault: false }), project({ id: "trial-project", isDefault: true })] });

    result.current.createApiKey();

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ name: ONBOARDING_API_KEY_NAME, projectId: "trial-project" }), expect.anything());
  });

  it("creates the key without a project when no project is the default", () => {
    const { result, mutate } = setup({ projects: [project({ id: "other-project", isDefault: false })] });

    result.current.createApiKey();

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ projectId: undefined }), expect.anything());
  });

  it("creates the key without a project when projects are off", () => {
    const { result, mutate } = setup({ isProjectsUiEnabled: false });

    result.current.createApiKey();

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ projectId: undefined }), expect.anything());
  });

  it("gives the key the default one year expiry", () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T12:00:00Z") });
    const { result, mutate } = setup({});

    result.current.createApiKey();

    expect((mutate.mock.calls[0][0] as NewApiKey).expiresAt).toEqual(addDays(new Date("2026-11-03T12:00:00Z"), 365));
    vi.useRealTimers();
  });

  it.each([
    { enabled: true, isProjectsUiEnabled: true, loadsProjects: true },
    { enabled: false, isProjectsUiEnabled: true, loadsProjects: false },
    { enabled: true, isProjectsUiEnabled: false, loadsProjects: false }
  ])("loads projects only when the tools path is open and projects are on (%o)", ({ enabled, isProjectsUiEnabled, loadsProjects }) => {
    const { useProjectsQuery } = setup({ enabled, isProjectsUiEnabled });

    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: loadsProjects });
  });

  it("reports while the trial project is loading", () => {
    const { result } = setup({ isLoadingProjects: true });

    expect(result.current.isLoadingTrialProject).toBe(true);
  });

  it("exposes the created key and whether it is being created", () => {
    const createdApiKey = mock<ApiKeyResponse>({ apiKey: "ac.sk.staging.secret" });
    const { result } = setup({ createdApiKey, isPending: true });

    expect(result.current.createdApiKey).toBe(createdApiKey);
    expect(result.current.isCreating).toBe(true);
  });

  it("tracks the key as created from onboarding once the api answers", () => {
    const { result, mutate, analyticsService } = setup({});

    result.current.createApiKey();
    expect(analyticsService.track).not.toHaveBeenCalled();
    (mutate.mock.calls[0][1] as MutateOptions).onSuccess();

    expect(analyticsService.track).toHaveBeenCalledWith("create_api_key", { category: "onboarding", label: "Create API key" });
  });

  it("tells the user when the key can't be created", () => {
    const { result, mutate, enqueueSnackbar, analyticsService } = setup({});

    result.current.createApiKey();
    (mutate.mock.calls[0][1] as MutateOptions).onError();

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the API key" }) }), {
      variant: "error"
    });
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  function project(input: Partial<Project>) {
    return mock<Project>({ id: "project", isDefault: false, ...input });
  }

  function setup(input: {
    enabled?: boolean;
    isProjectsUiEnabled?: boolean;
    projects?: Project[];
    isLoadingProjects?: boolean;
    createdApiKey?: ApiKeyResponse;
    isPending?: boolean;
  }) {
    const mutate = vi.fn();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>(), { data: input.projects, isLoading: input.isLoadingProjects ?? false })
    );
    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useProjectsUi: () => mock<ReturnType<typeof DEPENDENCIES.useProjectsUi>>({ isEnabled: input.isProjectsUiEnabled ?? true }),
      useProjectsQuery,
      useCreateApiKey: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useCreateApiKey>>(), { mutate, data: input.createdApiKey, isPending: input.isPending ?? false })
    };

    const { result } = renderHook(() => useOnboardingApiKey({ enabled: input.enabled ?? true }, dependencies));

    return { result, mutate, enqueueSnackbar, analyticsService, useProjectsQuery };
  }
});
