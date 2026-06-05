import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./SdlPreviewPane";
import { SdlPreviewPane } from "./SdlPreviewPane";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("SdlPreviewPane", () => {
  it("renders nothing when closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByTestId("sdl-editor-mock")).not.toBeInTheDocument();
  });

  it("renders the SDL in a read-only editor when open", () => {
    const { SDLEditor } = setup({ isOpen: true, sdl: 'version: "2.0"' });

    expect(SDLEditor).toHaveBeenCalledWith(expect.objectContaining({ value: 'version: "2.0"', readonly: true }), expect.anything());
  });

  it("requests opening on mod+shift+Y when closed", async () => {
    const { onOpen, onClose } = setup({ isOpen: false });

    await userEvent.keyboard("{Control>}{Shift>}[KeyY]{/Shift}{/Control}");

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requests closing on mod+shift+Y when open", async () => {
    const { onOpen, onClose } = setup({ isOpen: true });

    await userEvent.keyboard("{Control>}{Shift>}[KeyY]{/Shift}{/Control}");

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores the key without both modifiers", async () => {
    const { onOpen, onClose } = setup({ isOpen: false });

    await userEvent.keyboard("{Control>}[KeyY]{/Control}");
    await userEvent.keyboard("{Shift>}[KeyY]{/Shift}");

    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requests closing when the close button is clicked", async () => {
    const { onClose } = setup({ isOpen: true });

    await userEvent.click(screen.getByRole("button", { name: "Close SDL preview" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  function setup(input: { isOpen: boolean; sdl?: string }) {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const SDLEditor = vi.fn(() => <div data-testid="sdl-editor-mock" />);
    const dependencies: typeof DEPENDENCIES = {
      SDLEditor: SDLEditor as never
    };

    render(<SdlPreviewPane sdl={input.sdl ?? ""} isOpen={input.isOpen} onOpen={onOpen} onClose={onClose} dependencies={dependencies} />);

    return { onOpen, onClose, SDLEditor };
  }
});
