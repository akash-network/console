import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./TemplateList";
import { TemplateList } from "./TemplateList";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(TemplateList.name, () => {
  it("hides the Build and Deploy card when the flag is disabled", () => {
    setup({ isBuildAndDeployEnabled: false });

    expect(screen.queryByText("Build and Deploy")).not.toBeInTheDocument();
    expect(screen.getByText("Launch Container-VM")).toBeInTheDocument();
    expect(screen.getByText("Run Custom Container")).toBeInTheDocument();
  });

  it("shows the Build and Deploy card when the flag is enabled", () => {
    setup({ isBuildAndDeployEnabled: true });

    expect(screen.getByText("Build and Deploy")).toBeInTheDocument();
    expect(screen.getByText("Launch Container-VM")).toBeInTheDocument();
    expect(screen.getByText("Run Custom Container")).toBeInTheDocument();
  });

  it("hides the Agent mode panel when the flag is disabled", () => {
    setup({ isAgentModeEnabled: false });
    expect(screen.queryByText("Deploy with Agent mode")).not.toBeInTheDocument();
  });

  it("shows the Agent mode panel when the flag is enabled", () => {
    setup({ isAgentModeEnabled: true });
    expect(screen.getByText("Deploy with Agent mode")).toBeInTheDocument();
  });

  it("uploads a valid SDL into a configure draft and routes to configure when the redesign flag is on", async () => {
    const { push, createConfigureDraft, onTemplateSelected, enqueueSnackbar } = setup({ isRedesignEnabled: true });

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("deploy: from-file"));

    await waitFor(() => expect(createConfigureDraft).toHaveBeenCalledWith("deploy: from-file"));
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ draftId: "draft-xyz" }));
    expect(onTemplateSelected).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("rejects an invalid SDL at the picker: surfaces an error and neither drafts nor navigates", async () => {
    const { push, createConfigureDraft, enqueueSnackbar } = setup({ isRedesignEnabled: true, importSdlThrows: true });

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("not a valid sdl"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" })));
    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("uploads an SDL into the legacy editor step when the redesign flag is off", async () => {
    const { push, createConfigureDraft, onTemplateSelected, setEditedManifest } = setup({ isRedesignEnabled: false });

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("deploy: from-file"));

    await waitFor(() => expect(setEditedManifest).toHaveBeenCalledWith("deploy: from-file"));
    expect(onTemplateSelected).toHaveBeenCalledWith(expect.objectContaining({ code: "from-file", content: "deploy: from-file" }));
    expect(push).toHaveBeenCalledWith(UrlService.newDeployment({ step: RouteStep.editDeployment }));
    expect(createConfigureDraft).not.toHaveBeenCalled();
  });

  /** A YAML File the mocked FileButton hands to the upload handler, standing in for the browser's file picker. */
  function sdlFile(content: string) {
    return new File([content], "deploy.yaml", { type: "application/x-yaml" });
  }

  function setup(input: { isBuildAndDeployEnabled?: boolean; isRedesignEnabled?: boolean; isAgentModeEnabled?: boolean; importSdlThrows?: boolean }) {
    const push = vi.fn();
    const onTemplateSelected = vi.fn();
    const setEditedManifest = vi.fn();
    const createConfigureDraft = vi.fn(() => "draft-xyz");
    const enqueueSnackbar = vi.fn();
    const importSimpleSdl: typeof DEPENDENCIES.importSimpleSdl = input.importSdlThrows
      ? vi.fn(() => {
          throw new Error("invalid sdl");
        })
      : vi.fn();
    const analyticsService = mock<AnalyticsService>();
    // Stable references across renders — a fresh `templates` array each render would re-trigger
    // TemplateList's `useEffect([templates])` indefinitely (react-query returns a stable ref in prod).
    const templatesResult = mock<ReturnType<typeof DEPENDENCIES.useTemplates>>({ templates: [] });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });

    const FileButton: typeof DEPENDENCIES.FileButton = ({ onFileSelect }) => (
      <label>
        Upload SDL
        <input type="file" onChange={event => onFileSelect?.(event.currentTarget.files?.[0] ?? null)} />
      </label>
    );

    const dependencies: typeof DEPENDENCIES = {
      useTemplates: () => templatesResult,
      useRouter: () => router,
      useFlag: flagName => {
        if (flagName === "ui_build_and_deploy") return input.isBuildAndDeployEnabled ?? false;
        if (flagName === "onboarding_redesign_v1") return input.isRedesignEnabled ?? false;
        if (flagName === "ui_agent_mode_deploy") return input.isAgentModeEnabled ?? false;
        return false;
      },
      useNewDeploymentUrl: () => params => UrlService.newDeployment(params),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: () => null,
      importSimpleSdl,
      FileButton,
      createConfigureDraft
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TemplateList onChangeGitProvider={vi.fn()} onTemplateSelected={onTemplateSelected} setEditedManifest={setEditedManifest} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { push, analyticsService, onTemplateSelected, setEditedManifest, createConfigureDraft, enqueueSnackbar };
  }
});
