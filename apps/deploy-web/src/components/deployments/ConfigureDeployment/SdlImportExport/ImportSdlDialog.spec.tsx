import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { NoVisibleServiceError } from "../importDeploymentState/importDeploymentState";
import type { DEPENDENCIES } from "./ImportSdlDialog";
import { ImportSdlDialog } from "./ImportSdlDialog";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const IMPORTED_STATE: ImportedDeploymentState = { values: mock<SdlBuilderFormValuesType>(), sdl: "imported-sdl", selectedServiceId: "svc-1", changes: [] };

const VALID_SDL = `version: "2.0"
services:
  web:
    image: nginx:1.27-alpine
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const TWO_PLACEMENT_SDL = `version: "2.0"
services:
  api:
    image: ghcr.io/acme/api:1.0.0
  web:
    image: nginx:1.27-alpine
  worker:
    image: ghcr.io/acme/worker:1.0.0
profiles:
  compute:
    small:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    edge:
      attributes:
        region: us-east
      pricing:
        small:
          denom: uact
          amount: 1000
    dcloud:
      pricing:
        small:
          denom: uact
          amount: 1000
deployment:
  api:
    edge:
      profile: small
      count: 1
  web:
    dcloud:
      profile: small
      count: 1
  worker:
    dcloud:
      profile: small
      count: 1
`;

describe(ImportSdlDialog.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it("introduces the import with its default title and description", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Import SDL" })).toBeInTheDocument();
    expect(
      screen.getByText("Paste a deploy.yaml to fill in placements, services, hardware, env vars, and ports. You can adjust everything afterwards.")
    ).toBeInTheDocument();
  });

  it("names itself and explains the import in the words the caller gives", () => {
    setup({ title: "Import this deployment's SDL", description: "Paste the SDL this deployment was created with." });

    expect(screen.getByRole("dialog", { name: "Import this deployment's SDL" })).toBeInTheDocument();
    expect(screen.getByText("Paste the SDL this deployment was created with.")).toBeInTheDocument();
  });

  it("promises validation and disables Apply while the box is empty", () => {
    setup({});

    expect(screen.getByRole("status")).toHaveTextContent("We'll validate the SDL as you paste it.");
    expect(screen.getByRole("button", { name: "Apply SDL" })).toBeDisabled();
    expect(screen.getByLabelText("SDL")).toHaveAttribute("spellcheck", "false");
  });

  it("summarizes a valid paste and applies it to the form as pasted", async () => {
    const { onImport, onClose, importDeploymentState } = setup({});

    await pasteSdl(VALID_SDL);
    expect(screen.getByRole("status")).toHaveTextContent("1 placement · 1 service");
    expect(screen.getByRole("status")).toHaveTextContent("dcloud (any region): web");
    expect(screen.getByRole("status")).not.toHaveTextContent("We'll validate the SDL as you paste it.");
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));

    expect(importDeploymentState).toHaveBeenLastCalledWith(VALID_SDL);
    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "paste" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("counts several placements and services in the plural", async () => {
    setup({});

    await pasteSdl(TWO_PLACEMENT_SDL);

    expect(screen.getByRole("status")).toHaveTextContent("2 placements · 3 services");
    expect(screen.getByRole("status")).toHaveTextContent("edge (us-east): api · dcloud (any region): web, worker");
  });

  it("hands a caller that wants only the sdl the text as written, without reading it into the form", async () => {
    const { onImportSdl, importDeploymentState } = setup({ takesSdlAsWritten: true });

    await pasteSdl(VALID_SDL);
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));

    expect(onImportSdl).toHaveBeenCalledWith(VALID_SDL, { method: "paste" });
    expect(importDeploymentState).not.toHaveBeenCalled();
  });

  it("explains why an sdl the form can't hold is refused and keeps Apply disabled", async () => {
    const { onImport } = setup({
      importResult: () => {
        throw new NoVisibleServiceError("This SDL doesn't define any services to configure.");
      }
    });

    await pasteSdl(VALID_SDL);

    expect(screen.getByRole("status")).toHaveTextContent("This SDL doesn't define any services to configure.");
    expect(screen.getByRole("button", { name: "Apply SDL" })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("reports a yaml error as the text is typed", async () => {
    setup({});

    await userEvent.type(screen.getByLabelText("SDL"), "services:\n  web:\n image: nginx\n  bad");

    expect(screen.getByRole("status")).toHaveTextContent("Line 3: bad indentation of a mapping entry");
    expect(screen.getByRole("button", { name: "Apply SDL" })).toBeDisabled();
  });

  it("fills the box from an attached file and reports the file method", async () => {
    const { onImport } = setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile(VALID_SDL));
    await waitFor(() => expect(screen.getByLabelText("SDL")).toHaveValue(VALID_SDL));
    expect(screen.getByText("Loaded deploy.yaml. Review it above.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));

    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "file" });
  });

  it("reports the paste method and forgets the file once an attached file is edited", async () => {
    const { onImport } = setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile(VALID_SDL));
    await waitFor(() => expect(screen.getByLabelText("SDL")).toHaveValue(VALID_SDL));
    await userEvent.type(screen.getByLabelText("SDL"), "\n");
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));

    expect(screen.getByText("…or drop a deploy.yaml onto the box above.")).toBeInTheDocument();
    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "paste" });
  });

  it("does nothing when the file picker closes without a file", () => {
    setup({});

    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [] } });

    expect(screen.getByLabelText("SDL")).toHaveValue("");
  });

  it("shows a drop target while a file is dragged over the box and hides it when the drag leaves", () => {
    setup({});
    const box = screen.getByLabelText("SDL");
    expect(screen.queryByText("Drop your .yaml file")).not.toBeInTheDocument();

    const browserMayHandleDragOver = fireEvent.dragOver(box);
    expect(browserMayHandleDragOver).toBe(false);
    expect(screen.getByText("Drop your .yaml file")).toBeInTheDocument();

    fireEvent.dragLeave(box);
    expect(screen.queryByText("Drop your .yaml file")).not.toBeInTheDocument();
  });

  it("fills the box from a dropped file", async () => {
    const { onImport } = setup({});
    const box = screen.getByLabelText("SDL");

    fireEvent.dragOver(box);
    const browserMayOpenDroppedFile = fireEvent.drop(box, { dataTransfer: { files: [sdlFile(VALID_SDL)] } });

    expect(browserMayOpenDroppedFile).toBe(false);
    expect(screen.queryByText("Drop your .yaml file")).not.toBeInTheDocument();
    await waitFor(() => expect(box).toHaveValue(VALID_SDL));
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));
    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "file" });
  });

  it("ignores a drop that carries no file", () => {
    setup({});
    const box = screen.getByLabelText("SDL");

    fireEvent.drop(box, { dataTransfer: { files: [] } });

    expect(box).toHaveValue("");
  });

  it("offers the caller's example and reports the example method", async () => {
    const { onImport } = setup({ exampleSdl: VALID_SDL });

    await userEvent.click(screen.getByRole("button", { name: "Use an example" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply SDL" }));

    expect(screen.getByLabelText("SDL")).toHaveValue(VALID_SDL);
    expect(onImport).toHaveBeenCalledWith(IMPORTED_STATE, { method: "example" });
  });

  it("offers no example when the caller has none", () => {
    setup({});

    expect(screen.queryByRole("button", { name: "Use an example" })).not.toBeInTheDocument();
  });

  it("ignores a slow file read once the box has been edited", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile("stale: sdl"));
    await userEvent.type(screen.getByLabelText("SDL"), "fresh");
    act(() => reads[0].emitLoad("stale: sdl"));

    expect(screen.getByLabelText("SDL")).toHaveValue("fresh");
  });

  it("reports a file that can't be read", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile("some: sdl"));
    act(() => reads[0].emitError());

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't read the file. Please try again.");
  });

  it("suppresses a read error for a file superseded by a newer edit", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile("stale: sdl"));
    await userEvent.type(screen.getByLabelText("SDL"), "fresh");
    act(() => reads[0].emitError());

    expect(screen.getByRole("status")).not.toHaveTextContent("Couldn't read the file. Please try again.");
  });

  it("fills the box with an empty file as empty text", async () => {
    const reads = captureFileReads();
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile(""));
    act(() => reads[0].emitLoad(null));

    expect(screen.getByLabelText("SDL")).toHaveValue("");
    expect(screen.getByText("Loaded deploy.yaml. Review it above.")).toBeInTheDocument();
  });

  it("rejects an oversized file without reading it and keeps Apply disabled over a valid paste", async () => {
    const { importDeploymentState } = setup({});
    await pasteSdl(VALID_SDL);
    importDeploymentState.mockClear();

    await userEvent.upload(screen.getByLabelText("Attach a file"), oversizedFile());

    expect(screen.getByRole("status")).toHaveTextContent("This file is too large to be an SDL. Choose a file under 512 KB.");
    expect(screen.getByLabelText("SDL")).toHaveValue(VALID_SDL);
    expect(screen.getByRole("button", { name: "Apply SDL" })).toBeDisabled();
    expect(importDeploymentState).not.toHaveBeenCalled();
  });

  it("clears a file error once the box is edited", async () => {
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), oversizedFile());
    await userEvent.type(screen.getByLabelText("SDL"), "a");

    expect(screen.getByRole("status")).not.toHaveTextContent("This file is too large to be an SDL. Choose a file under 512 KB.");
  });

  it("clears a file error once a readable file loads", async () => {
    setup({});

    await userEvent.upload(screen.getByLabelText("Attach a file"), oversizedFile());
    await userEvent.upload(screen.getByLabelText("Attach a file"), sdlFile(VALID_SDL));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 placement · 1 service"));
  });

  it("closes without importing when Cancel is clicked", async () => {
    const { onClose, onImport } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("closes when the dialog is dismissed", async () => {
    const { onClose } = setup({});

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  async function pasteSdl(sdl: string) {
    await userEvent.click(screen.getByLabelText("SDL"));
    await userEvent.paste(sdl);
  }

  function captureFileReads() {
    const reads: Array<{ emitLoad: (content: string | null) => void; emitError: () => void }> = [];
    vi.stubGlobal(
      "FileReader",
      class {
        onload: ((event: { target: { result: string | null } }) => void) | null = null;
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

  function setup(input: {
    importResult?: () => ImportedDeploymentState;
    title?: string;
    description?: string;
    exampleSdl?: string;
    takesSdlAsWritten?: boolean;
  }) {
    const onClose = vi.fn();
    const onImport = vi.fn();
    const onImportSdl = vi.fn();
    const importDeploymentState = vi.fn(input.importResult ?? (() => IMPORTED_STATE));

    const FileButton: typeof DEPENDENCIES.FileButton = ({ onFileSelect, children }) => (
      <label>
        {children}
        <input type="file" onChange={event => onFileSelect?.(event.currentTarget.files?.[0] ?? null)} />
      </label>
    );

    render(
      <ImportSdlDialog
        onClose={onClose}
        {...(input.takesSdlAsWritten ? { onImportSdl } : { onImport })}
        title={input.title}
        description={input.description}
        exampleSdl={input.exampleSdl}
        dependencies={{ FileButton, importDeploymentState }}
      />
    );

    return { onClose, onImport, onImportSdl, importDeploymentState };
  }
});
