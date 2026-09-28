import { describe, expect, it } from "vitest";

import { useSdlPreviewPanel } from "./useSdlPreviewPanel";

import { act, renderHook } from "@testing-library/react";

describe(useSdlPreviewPanel.name, () => {
  it("reports whether the preview panel feature is on", () => {
    const { result } = renderHook(() => useSdlPreviewPanel({ useFlag: flag => flag === "ui_sdl_preview_panel" }));

    expect(result.current.isEnabled).toBe(true);
  });

  it("opens and closes the preview panel", () => {
    const { result } = renderHook(() => useSdlPreviewPanel({ useFlag: () => true }));

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});
