import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./UploadSdlButton";
import { UploadSdlButton } from "./UploadSdlButton";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("UploadSdlButton", () => {
  it("opens a valid SDL in a configure draft and tracks the upload", async () => {
    const { push, createConfigureDraft, enqueueSnackbar, analyticsService, FileButton } = setup({});

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("deploy: from-file"));

    await waitFor(() => expect(createConfigureDraft).toHaveBeenCalledWith("deploy: from-file"));
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ draftId: "draft-xyz" }));
    expect(analyticsService.track).toHaveBeenCalledWith("sdl_uploaded", "Amplitude");
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(FileButton).toHaveBeenCalledWith(expect.objectContaining({ accept: ".yml,.yaml,.txt" }), expect.anything());
  });

  it("keeps the user on the page with an error when the file isn't a valid SDL", async () => {
    const { push, createConfigureDraft, enqueueSnackbar, analyticsService, Snackbar } = setup({ importSdlThrows: true });

    await userEvent.upload(screen.getByLabelText("Upload SDL"), sdlFile("not a valid sdl"));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" }));
    render(enqueueSnackbar.mock.calls[0][0]);
    expect(Snackbar).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid SDL file", iconVariant: "error" }), expect.anything());
    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("does nothing when the picker closes without a file", () => {
    const { push, createConfigureDraft, enqueueSnackbar } = setup({});

    fireEvent.change(screen.getByLabelText("Upload SDL"), { target: { files: [] } });

    expect(createConfigureDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  function sdlFile(content: string) {
    return new File([content], "deploy.yaml", { type: "application/x-yaml" });
  }

  function setup(input: { importSdlThrows?: boolean }) {
    const push = vi.fn();
    const createConfigureDraft = vi.fn(() => "draft-xyz");
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const importSimpleSdl: typeof DEPENDENCIES.importSimpleSdl = input.importSdlThrows
      ? vi.fn(() => {
          throw new Error("invalid sdl");
        })
      : vi.fn();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
    const Snackbar = vi.fn(() => null);
    const FileButton = vi.fn<typeof DEPENDENCIES.FileButton>(({ onFileSelect }) => (
      <label>
        Upload SDL
        <input type="file" onChange={event => onFileSelect?.(event.currentTarget.files?.[0] ?? null)} />
      </label>
    ));

    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar,
      FileButton,
      importSimpleSdl,
      createConfigureDraft
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <UploadSdlButton dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { push, createConfigureDraft, enqueueSnackbar, analyticsService, Snackbar, FileButton };
  }
});
