import type { ReactNode } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ViewPanel } from "./ViewPanel";

import { render, screen, waitFor } from "@testing-library/react";

describe(ViewPanel.name, () => {
  describe("when stuck to the bottom", () => {
    it("fills the viewport below it, less the padding its containers keep under it", () => {
      const { panel } = setup({ viewport: { width: 1280, height: 800 }, top: 300, containerPaddings: [24, 8] });

      expect(panel.style.height).toBe("468px");
    });

    it("keeps 60% of a phone viewport when the page above leaves less room", () => {
      const { panel } = setup({ viewport: { width: 375, height: 812 }, top: 700, containerPaddings: [24] });

      expect(panel.style.height).toBe("487px");
    });

    it("fills a phone viewport below it when that is more than 60% of it", () => {
      const { panel } = setup({ viewport: { width: 375, height: 812 }, top: 100, containerPaddings: [24] });

      expect(panel.style.height).toBe("688px");
    });

    it("keeps 30% of a wider viewport when the page above leaves less room", () => {
      const { panel } = setup({ viewport: { width: 1280, height: 800 }, top: 700, containerPaddings: [24] });

      expect(panel.style.height).toBe("240px");
    });

    it.each([
      { width: 767, expectedHeight: "600px" },
      { width: 768, expectedHeight: "300px" }
    ])("treats a $width px wide viewport by its own share of the height", ({ width, expectedHeight }) => {
      const { panel } = setup({ viewport: { width, height: 1000 }, top: 950, containerPaddings: [] });

      expect(panel.style.height).toBe(expectedHeight);
    });

    it("measures again when the page above it settles after the first measure", async () => {
      const { panel, moveTo, resizeContainerOf } = setup({ viewport: { width: 1280, height: 800 }, top: 300, containerPaddings: [24] });

      moveTo(336);
      resizeContainerOf(panel);

      await waitFor(() => expect(panel.style.height).toBe("440px"));
    });

    it("stops watching its containers once it is gone", () => {
      const { panel, unmount, isWatching } = setup({ viewport: { width: 1280, height: 800 }, top: 300, containerPaddings: [24] });
      const container = panel.parentElement as HTMLElement;

      unmount();

      expect(isWatching(container)).toBe(false);
    });
  });

  describe("when not stuck to the bottom", () => {
    it("leaves its containers unwatched", () => {
      const { panel, isWatching } = setup({ viewport: { width: 1280, height: 800 }, top: 300, containerPaddings: [24], stickToBottom: false });

      expect(isWatching(panel.parentElement as HTMLElement)).toBe(false);
    });

    it("starts watching its containers once it becomes stuck to the bottom", () => {
      const { panel, rerenderStuckToBottom, isWatching } = setup({
        viewport: { width: 1280, height: 800 },
        top: 300,
        containerPaddings: [24],
        stickToBottom: false
      });

      rerenderStuckToBottom();

      expect(isWatching(panel.parentElement as HTMLElement)).toBe(true);
    });
  });

  function setup(input: { viewport: { width: number; height: number }; top: number; containerPaddings: number[]; stickToBottom?: boolean }) {
    const watchers: { notify: () => void; targets: Set<Element> }[] = [];
    class ResizeObserverDouble {
      private readonly targets = new Set<Element>();

      constructor(notify: () => void) {
        watchers.push({ notify, targets: this.targets });
      }

      observe(target: Element) {
        this.targets.add(target);
      }

      disconnect() {
        this.targets.clear();
      }
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    vi.stubGlobal("innerWidth", input.viewport.width);
    vi.stubGlobal("innerHeight", input.viewport.height);
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(mock<DOMRect>({ top: input.top, width: 600 }));
    onTestFinished(() => {
      getBoundingClientRect.mockRestore();
      vi.unstubAllGlobals();
    });

    function renderPanel(stickToBottom: boolean) {
      const panel = stickToBottom ? (
        <ViewPanel stickToBottom>
          <span>panel content</span>
        </ViewPanel>
      ) : (
        <ViewPanel ratio={0.5}>
          <span>panel content</span>
        </ViewPanel>
      );
      return input.containerPaddings.reduceRight<ReactNode>(
        (content, paddingBottom) => <div style={{ paddingBottom: `${paddingBottom}px` }}>{content}</div>,
        panel
      );
    }

    const { rerender, unmount } = render(renderPanel(input.stickToBottom ?? true));

    return {
      panel: screen.getByText("panel content").parentElement as HTMLElement,
      unmount,
      rerenderStuckToBottom: () => rerender(renderPanel(true)),
      moveTo: (top: number) => getBoundingClientRect.mockReturnValue(mock<DOMRect>({ top, width: 600 })),
      resizeContainerOf: (panel: HTMLElement) =>
        watchers.filter(watcher => watcher.targets.has(panel.parentElement as HTMLElement)).forEach(watcher => watcher.notify()),
      isWatching: (container: HTMLElement) => watchers.some(watcher => watcher.targets.has(container))
    };
  }
});
