import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { NoVisibleServiceError } from "../importDeploymentState/importDeploymentState";
import type { DEPENDENCIES } from "./ImportSdlDialog";
import { ImportSdlDialog } from "./ImportSdlDialog";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const IMPORTED_STATE: ImportedDeploymentState = { values: mock<SdlBuilderFormValuesType>(), sdl: "imported-sdl", selectedServiceId: "svc-1" };

describe(ImportSdlDialog.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it("disables Import while the editor is empty", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("imports pasted text and reports the paste method", async () => {
    const { onImport, importDeploymentState } = setup({});

    await userEvent.type(screen.getByLabelText("SDL editor"), "some: sdl");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(importDeploymentState).toHaveBeenCalledWith("some: sdl");
    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "paste" });
  });

  it("disables Import while the editor reports validation errors", async () => {
    setup({});

    await userEvent.type(screen.getByLabelText("SDL editor"), "invalid: sdl");
    await userEvent.click(screen.getByRole("button", { name: "mark invalid" }));

    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("re-enables Import once the editor reports the sdl is valid", async () => {
    setup({});

    await userEvent.type(screen.getByLabelText("SDL editor"), "some: sdl");
    await userEvent.click(screen.getByRole("button", { name: "mark invalid" }));
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "mark valid" }));

    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("shows a known parser error inline, keeps the dialog open, and does not import", async () => {
    const error = Object.assign(new Error("bad indentation at line 3"), { name: "YAMLException" });
    const { onImport } = setup({
      importResult: () => {
        throw error;
      }
    });

    await userEvent.type(screen.getByLabelText("SDL editor"), "bad: sdl");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("bad indentation at line 3")).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("shows the no-services message when the SDL defines nothing to configure", async () => {
    const error = new NoVisibleServiceError("This SDL doesn't define any services to configure.");
    setup({
      importResult: () => {
        throw error;
      }
    });

    await userEvent.type(screen.getByLabelText("SDL editor"), "version: '2.0'");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("This SDL doesn't define any services to configure.")).toBeInTheDocument();
  });

  it("shows a generic fallback for an unrecognized error", async () => {
    setup({
      importResult: () => {
        throw new TypeError("cannot read properties of undefined");
      }
    });

    await userEvent.type(screen.getByLabelText("SDL editor"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("This config couldn't be parsed. Check the file and try again.")).toBeInTheDocument();
  });

  it("clears the error message when the editor is edited again", async () => {
    setup({
      importResult: () => {
        throw new TypeError("boom");
      }
    });

    await userEvent.type(screen.getByLabelText("SDL editor"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText("This config couldn't be parsed. Check the file and try again.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("SDL editor"), "2");

    expect(screen.queryByText("This config couldn't be parsed. Check the file and try again.")).not.toBeInTheDocument();
  });

  it("populates the editor from an uploaded file", async () => {
    setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), sdlFile("uploaded: sdl"));

    await waitFor(() => expect(screen.getByLabelText("SDL editor")).toHaveValue("uploaded: sdl"));
  });

  it("reports the file method for an unedited upload", async () => {
    const { onImport } = setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), sdlFile("uploaded: sdl"));
    await waitFor(() => expect(screen.getByLabelText("SDL editor")).toHaveValue("uploaded: sdl"));
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "file" });
  });

  it("reports the paste method when an uploaded file is then edited", async () => {
    const { onImport } = setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), sdlFile("uploaded: sdl"));
    await waitFor(() => expect(screen.getByLabelText("SDL editor")).toHaveValue("uploaded: sdl"));
    await userEvent.type(screen.getByLabelText("SDL editor"), " edited");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "paste" });
  });

  it("ignores a slow file read once the editor has been edited", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), sdlFile("stale: sdl"));
    await userEvent.type(screen.getByLabelText("SDL editor"), "fresh");
    act(() => reads[0].emitLoad("stale: sdl"));

    expect(screen.getByLabelText("SDL editor")).toHaveValue("fresh");
  });

  it("suppresses a read error for a file superseded by a newer edit", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), sdlFile("stale: sdl"));
    await userEvent.type(screen.getByLabelText("SDL editor"), "fresh");
    act(() => reads[0].emitError());

    expect(screen.queryByText("Couldn't read the file. Please try again.")).not.toBeInTheDocument();
  });

  it("rejects an oversized file without reading it", async () => {
    const { importDeploymentState } = setup({});

    await userEvent.upload(screen.getByLabelText("Upload file"), oversizedFile());

    expect(screen.getByText("This file is too large to be a config. Choose a file under 512 KB.")).toBeInTheDocument();
    expect(screen.getByLabelText("SDL editor")).toHaveValue("");
    expect(importDeploymentState).not.toHaveBeenCalled();
  });

  it("closes without importing when Cancel is clicked", async () => {
    const { onClose, onImport } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  function captureFileReads() {
    const reads: Array<{ emitLoad: (content: string) => void; emitError: () => void }> = [];
    vi.stubGlobal(
      "FileReader",
      class {
        onload: ((event: { target: { result: string } }) => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText() {
          reads.push({
            emitLoad: content => this.onload?.({ target: { result: content } }),
            emitError: () => this.onerror?.()
          });
        }
      }
    );
    return reads;
  }

  function sdlFile(content: string) {
    return new File([content], "deploy.yaml", { type: "application/x-yaml" });
  }

  function oversizedFile() {
    return new File(["a".repeat(512 * 1024 + 1)], "huge.yaml", { type: "application/x-yaml" });
  }

  function setup(input: { importResult?: () => ImportedDeploymentState }) {
    const onClose = vi.fn();
    const onImport = vi.fn();
    const importDeploymentState = vi.fn(input.importResult ?? (() => IMPORTED_STATE));

    const SDLEditor = (({
      value,
      onChange,
      onValidate
    }: {
      value?: string;
      onChange?: (value: string) => void;
      onValidate?: (event: { isValid: boolean }) => void;
    }) => (
      <div>
        <textarea aria-label="SDL editor" value={value ?? ""} onChange={event => onChange?.(event.target.value)} />
        <button type="button" onClick={() => onValidate?.({ isValid: false })}>
          mark invalid
        </button>
        <button type="button" onClick={() => onValidate?.({ isValid: true })}>
          mark valid
        </button>
      </div>
    )) as never;
    const FileButton: typeof DEPENDENCIES.FileButton = ({ onFileSelect, children }) => (
      <label>
        {children}
        <input type="file" onChange={event => onFileSelect?.(event.currentTarget.files?.[0] ?? null)} />
      </label>
    );

    render(<ImportSdlDialog onClose={onClose} onImport={onImport} dependencies={{ SDLEditor, FileButton, importDeploymentState }} />);

    return { onClose, onImport, importDeploymentState };
  }
});
