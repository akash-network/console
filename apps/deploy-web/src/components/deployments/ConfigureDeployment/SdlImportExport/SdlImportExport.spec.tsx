import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import type { DEPENDENCIES } from "./SdlImportExport";
import { SdlImportExport } from "./SdlImportExport";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const IMPORTED_STATE: ImportedDeploymentState = { values: mock<SdlBuilderFormValuesType>(), sdl: "imported-sdl", selectedServiceId: "svc-1" };

describe(SdlImportExport.name, () => {
  it("opens the import dialog when Import is clicked", async () => {
    setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Import Config/ }));

    expect(screen.getByRole("button", { name: "trigger import" })).toBeInTheDocument();
  });

  it("disables Import while the flow is locked", async () => {
    setup({ canImport: false });

    await openMenu();

    expect(screen.getByRole("menuitem", { name: /Import Config/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("applies the import, shows a snackbar, tracks the method, and closes the dialog", async () => {
    const { onImport, analyticsService, enqueueSnackbar } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Import Config/ }));
    await userEvent.click(screen.getByRole("button", { name: "trigger import" }));

    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE);
    expect(analyticsService.track).toHaveBeenCalledWith("configure_sdl_imported", { category: "deployments", method: "file" });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
    expect(screen.queryByRole("button", { name: "trigger import" })).not.toBeInTheDocument();
  });

  it("downloads the sdl as a yaml file named after the deployment", async () => {
    const { saveAs } = setup({ sdl: "some: sdl", deploymentName: "My App 2!" });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Download .yaml" }));

    const [blob, filename] = saveAs.mock.calls[0];
    expect(filename).toBe("my-app-2.yaml");
    expect(blob.type).toBe("text/yaml;charset=utf-8");
    expect(await blob.text()).toBe("some: sdl");
  });

  it("falls back to a generic filename when the deployment name has no usable characters", async () => {
    const { saveAs } = setup({ sdl: "some: sdl", deploymentName: "!!!" });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Download .yaml" }));

    expect(saveAs.mock.calls[0][1]).toBe("deployment.yaml");
  });

  it("tracks the download", async () => {
    const { analyticsService } = setup({ sdl: "some: sdl" });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Download .yaml" }));

    expect(analyticsService.track).toHaveBeenCalledWith("configure_sdl_downloaded", { category: "deployments" });
  });

  it("copies the sdl to the clipboard, shows a snackbar, and tracks the copy", async () => {
    const { copyTextToClipboard, enqueueSnackbar, analyticsService } = setup({ sdl: "some: sdl" });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy to clipboard" }));

    expect(copyTextToClipboard).toHaveBeenCalledWith("some: sdl");
    await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("configure_sdl_copied", { category: "deployments" }));
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("shows an error and does not track the copy when the clipboard write fails", async () => {
    const { enqueueSnackbar, analyticsService } = setup({ sdl: "some: sdl", canCopy: false });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy to clipboard" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" })));
    expect(analyticsService.track).not.toHaveBeenCalledWith("configure_sdl_copied", { category: "deployments" });
  });

  it("disables the export actions when there is no sdl to export", async () => {
    setup({ sdl: "" });

    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Download .yaml" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Copy to clipboard" })).toHaveAttribute("aria-disabled", "true");
  });

  function openMenu() {
    return userEvent.click(screen.getByRole("button", { name: "SDL import and export" }));
  }

  function setup(input: { sdl?: string; deploymentName?: string; canImport?: boolean; canCopy?: boolean }) {
    const onImport = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const enqueueSnackbar = vi.fn();
    const saveAs = vi.fn<(data: Blob, filename: string) => void>();
    const copyTextToClipboard = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(input.canCopy ?? true);

    const ImportSdlDialog: typeof DEPENDENCIES.ImportSdlDialog = ({ onImport: onDialogImport }) => (
      <button type="button" onClick={() => onDialogImport(IMPORTED_STATE, { method: "file" })}>
        trigger import
      </button>
    );

    render(
      <SdlImportExport
        sdl={input.sdl ?? "default-sdl"}
        deploymentName={input.deploymentName ?? "my-app"}
        canImport={input.canImport ?? true}
        onImport={onImport}
        dependencies={{
          ImportSdlDialog,
          useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
          useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
          Snackbar: () => null,
          saveAs,
          copyTextToClipboard
        }}
      />
    );

    return { onImport, analyticsService, enqueueSnackbar, saveAs, copyTextToClipboard };
  }
});
