import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { helloWorldTemplate } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./TemplateList";
import { TemplateList } from "./TemplateList";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(TemplateList.name, () => {
  it("offers the container-vm and custom container options", () => {
    setup({});

    expect(screen.getByText("Launch Container-VM")).toBeInTheDocument();
    expect(screen.getByText("Run Custom Container")).toBeInTheDocument();
    expect(screen.queryByText("Build and Deploy")).not.toBeInTheDocument();
  });

  it("hides the Agent mode panel when the flag is disabled", () => {
    setup({ isAgentModeEnabled: false });
    expect(screen.queryByText("Deploy with your agent")).not.toBeInTheDocument();
  });

  it("shows the Agent mode panel when the flag is enabled", () => {
    setup({ isAgentModeEnabled: true });
    expect(screen.getByText("Deploy with your agent")).toBeInTheDocument();
  });

  it("uploads a valid SDL into a configure draft and routes to configure", async () => {
    const { push, createConfigureDraft, enqueueSnackbar } = setup({});

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("deploy: from-file"));

    await waitFor(() => expect(createConfigureDraft).toHaveBeenCalledWith("deploy: from-file"));
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ draftId: "draft-xyz" }));
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("rejects an invalid SDL at the picker: surfaces an error and neither drafts nor navigates", async () => {
    const { push, createConfigureDraft, enqueueSnackbar } = setup({ importSdlThrows: true });

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("not a valid sdl"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" })));
    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("routes Launch Container-VM straight to a container-vm configure entry", async () => {
    const { push, analyticsService } = setup({});

    await userEvent.click(screen.getByText("Launch Container-VM"));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ vm: true }));
    expect(analyticsService.track).toHaveBeenCalledWith("launch_container_vm_btn_clk", "Amplitude");
  });

  it("routes Run Custom Container to a blank configure screen", async () => {
    const { push, analyticsService } = setup({});

    await userEvent.click(screen.getByText("Run Custom Container"));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({}));
    expect(analyticsService.track).toHaveBeenCalledWith("run_custom_container_btn_clk", "Amplitude");
  });

  it("links the hello world template to configure", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Hello World" })).toHaveAttribute("href", UrlService.configureDeployment({ templateId: helloWorldTemplate.code }));
  });

  /** A YAML File the mocked FileButton hands to the upload handler, standing in for the browser's file picker. */
  function sdlFile(content: string) {
    return new File([content], "deploy.yaml", { type: "application/x-yaml" });
  }

  function setup(input: { isAgentModeEnabled?: boolean; importSdlThrows?: boolean }) {
    const push = vi.fn();
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
      useFlag: flagName => flagName === "ui_agent_mode_deploy" && (input.isAgentModeEnabled ?? false),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: () => null,
      importSimpleSdl,
      FileButton,
      createConfigureDraft
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TemplateList dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { push, analyticsService, createConfigureDraft, enqueueSnackbar };
  }
});
